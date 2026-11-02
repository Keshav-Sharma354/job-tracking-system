/**
 * Contact service — enforces that the company a contact is attached to belongs
 * to the same user, and that email addresses stay unique per user.
 */
import { isUniqueConstraintError } from "@/lib/db";
import { ActivityAction, ActivityEntity } from "@/generated/prisma/enums";
import type { ContactData } from "@/lib/validation/schemas";
import * as contactRepo from "@/server/repo/contacts";
import * as companyRepo from "@/server/repo/companies";
import { logActivity } from "@/server/repo/activity";
import { conflict, fieldError, internal, notFound, ok } from "@/lib/utils/result";
import type { ActionResult } from "@/lib/utils/result";
import type { ContactItem } from "@/server/repo/contacts";

export type { ContactItem };

/**
 * Returns a validation failure when the company does not belong to this user,
 * otherwise `null`. `ActionResult<never>` is assignable to any result type, so
 * callers can `return` it directly.
 */
async function assertCompanyOwned(
  userId: string,
  companyId: string | null,
): Promise<ActionResult<never> | null> {
  if (!companyId) return null;
  const company = await companyRepo.getCompanyById(userId, companyId);
  if (!company) {
    return fieldError("companyId", "That company no longer exists");
  }
  return null;
}

export async function createContact(
  userId: string,
  input: ContactData,
): Promise<ActionResult<ContactItem>> {
  const companyProblem = await assertCompanyOwned(userId, input.companyId);
  if (companyProblem) return companyProblem;

  if (input.email) {
    const duplicate = await contactRepo.findContactByEmail(userId, input.email);
    if (duplicate) {
      return conflict(
        `${duplicate.name} is already using ${input.email}. Edit that contact instead.`,
        "email",
      );
    }
  }

  try {
    const contact = await contactRepo.createContact(userId, input);

    await logActivity(userId, {
      action: ActivityAction.CREATED,
      entityType: ActivityEntity.CONTACT,
      entityId: contact.id,
      contactId: contact.id,
      summary: `Added contact ${contact.name}${contact.company ? ` at ${contact.company.name}` : ""}`,
    });

    return ok(contact, `${contact.name} added`);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return conflict("That email address is already in your contacts", "email");
    }
    console.error("createContact failed", error);
    return internal("Could not save this contact");
  }
}

export async function updateContact(
  userId: string,
  contactId: string,
  input: ContactData,
): Promise<ActionResult<ContactItem>> {
  const existing = await contactRepo.getContactById(userId, contactId);
  if (!existing) return notFound("That contact no longer exists");

  const companyProblem = await assertCompanyOwned(userId, input.companyId);
  if (companyProblem) return companyProblem;

  if (input.email && input.email.toLowerCase() !== existing.email?.toLowerCase()) {
    const duplicate = await contactRepo.findContactByEmail(userId, input.email);
    if (duplicate && duplicate.id !== contactId) {
      return conflict(
        `${duplicate.name} is already using ${input.email}. Edit that contact instead.`,
        "email",
      );
    }
  }

  try {
    const contact = await contactRepo.updateContact(userId, contactId, input);
    if (!contact) return notFound();

    await logActivity(userId, {
      action: ActivityAction.UPDATED,
      entityType: ActivityEntity.CONTACT,
      entityId: contact.id,
      contactId: contact.id,
      summary: `Updated contact ${contact.name}`,
    });

    return ok(contact, "Contact updated");
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return conflict("That email address is already in your contacts");
    }
    console.error("updateContact failed", error);
    return internal("Could not save your changes");
  }
}

export async function deleteContact(
  userId: string,
  contactId: string,
): Promise<ActionResult<{ id: string }>> {
  const existing = await contactRepo.getContactById(userId, contactId);
  if (!existing) return notFound("That contact no longer exists");

  const deleted = await contactRepo.deleteContact(userId, contactId);
  if (!deleted) return notFound();

  await logActivity(userId, {
    action: ActivityAction.DELETED,
    entityType: ActivityEntity.CONTACT,
    entityId: contactId,
    summary: `Deleted contact ${existing.name}`,
  });

  return ok({ id: contactId }, "Contact deleted");
}
