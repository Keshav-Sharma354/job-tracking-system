'use server';

/**
 * Authentication actions.
 *
 * These are the only actions that do not begin with `requireUserId()` — they are
 * the entry point. They are throttled by the auth service.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "@/lib/validation/schemas";
import { flattenIssues } from "@/lib/validation/fields";
import {
  startSession,
  endSession,
  requireUserId,
  requestIp,
  getSession,
} from "@/lib/auth/session";
import {
  authenticate,
  changePassword,
  isRegistrationEnabled,
  registerUser,
  updateProfile,
} from "@/server/services/auth";

export interface AuthFormState {
  errors?: Record<string, string>;
  message?: string;
  /** Non-field errors keep the form usable instead of forcing a redirect. */
  formError?: string;
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: flattenIssues(parsed.error) };
  }

  const result = await authenticate(
    parsed.data.email,
    parsed.data.password,
    await requestIp(),
  );

  if (!result.ok) {
    return { formError: result.error };
  }

  await startSession(result.data.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!isRegistrationEnabled()) {
    return {
      formError: "Self-service registration is disabled on this server.",
    };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { errors: flattenIssues(parsed.error) };
  }

  const result = await registerUser({
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
    ipAddress: await requestIp(),
  });

  if (!result.ok) {
    // Field-level conflicts are shown against the field; everything else is a
    // form-level problem.
    const fieldErrors = result.fieldErrors;
    if (fieldErrors) return { errors: fieldErrors, formError: result.error };
    return { formError: result.error };
  }

  await startSession(result.data.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function changePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const session = await getSession();
  if (!session) {
    return { formError: "You must sign in to continue" };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { errors: flattenIssues(parsed.error) };
  }

  const result = await changePassword(session.userId, {
    currentPassword: parsed.data.currentPassword,
    password: parsed.data.password,
  });

  if (!result.ok) {
    if (result.fieldErrors) return { errors: result.fieldErrors, formError: result.error };
    return { formError: result.error };
  }

  // The old sessions were destroyed; start a new one for this device.
  await startSession(session.userId);
  revalidatePath("/", "layout");
  return { message: result.message };
}

export async function updateProfileAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const userId = await requireUserId().catch(() => null);
  if (!userId) return { formError: "You must sign in to continue" };

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    return { errors: flattenIssues(parsed.error) };
  }

  const result = await updateProfile(userId, parsed.data);
  if (!result.ok) {
    return { formError: result.error };
  }

  revalidatePath("/", "layout");
  return { message: result.message };
}
