/**
 * Company service.
 */
import { isUniqueConstraintError } from "@/lib/db";
import { ActivityAction, ActivityEntity } from "@/generated/prisma/enums";
import type { CompanyData } from "@/lib/validation/schemas";
import * as companyRepo from "@/server/repo/companies";
import { logActivity } from "@/server/repo/activity";
import { conflict, internal, notFound, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";
import type { CompanyItem } from "@/server/repo/companies";

export type { CompanyItem };

export async function createCompany(
  userId: string,
  input: CompanyData,
): Promise<ActionResult<CompanyItem>> {
  const existing = await companyRepo.findCompanyByName(userId, input.name);
  if (existing) {
    return conflict(`You already track a company called ${existing.name}`, "name");
  }

  try {
    const company = await companyRepo.createCompany(userId, input);
    await logActivity(userId, {
      action: ActivityAction.CREATED,
      entityType: ActivityEntity.COMPANY,
      entityId: company.id,
      summary: `Added company ${company.name}`,
    });
    return ok(company, `${company.name} added`);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return conflict(`You already track a company called ${input.name}`, "name");
    }
    console.error("createCompany failed", error);
    return internal("Could not save this company");
  }
}

export async function updateCompany(
  userId: string,
  companyId: string,
  input: CompanyData,
): Promise<ActionResult<CompanyItem>> {
  const existing = await companyRepo.getCompanyById(userId, companyId);
  if (!existing) return notFound("That company no longer exists");

  const nameClash = await companyRepo.findCompanyByName(userId, input.name);
  if (nameClash && nameClash.id !== companyId) {
    return conflict(`You already track a company called ${input.name}`, "name");
  }

  try {
    const company = await companyRepo.updateCompany(userId, companyId, input);
    if (!company) return notFound();
    await logActivity(userId, {
      action: ActivityAction.UPDATED,
      entityType: ActivityEntity.COMPANY,
      entityId: company.id,
      summary: `Updated company ${company.name}`,
    });
    return ok(company, "Company updated");
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return conflict(`You already track a company called ${input.name}`);
    }
    console.error("updateCompany failed", error);
    return internal("Could not save your changes");
  }
}

export async function deleteCompany(
  userId: string,
  companyId: string,
): Promise<ActionResult<{ id: string }>> {
  const existing = await companyRepo.getCompanyById(userId, companyId);
  if (!existing) return notFound("That company no longer exists");

  const deleted = await companyRepo.deleteCompany(userId, companyId);
  if (!deleted) return notFound();

  await logActivity(userId, {
    action: ActivityAction.DELETED,
    entityType: ActivityEntity.COMPANY,
    entityId: companyId,
    summary: `Deleted company ${existing.name}`,
  });

  return ok({ id: companyId }, "Company deleted");
}
