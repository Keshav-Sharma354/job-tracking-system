"use client";

import * as React from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { loginAction, registerAction, type AuthFormState } from "@/app/actions/auth";

type Mode = "login" | "register";

/**
 * Combined sign-in / sign-up form.
 *
 * Both flows share the same server-action contract (`{ errors, formError }`), so
 * one component handles the two screens without duplicating validation display.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction] = React.useActionState<AuthFormState, FormData>(
    action,
    {},
  );

  const isRegister = mode === "register";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {isRegister ? (
        <Field
          label="Name"
          name="name"
          type="text"
          autoComplete="name"
          required
          error={state.errors?.name}
        />
      ) : null}

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.errors?.email}
      />

      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={isRegister ? "new-password" : "current-password"}
        required
        error={state.errors?.password}
        hint={
          isRegister
            ? "At least 12 characters with uppercase, lowercase and a number."
            : undefined
        }
      />

      {isRegister ? (
        <Field
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          error={state.errors?.confirmPassword}
        />
      ) : null}

      {state.formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.formError}</span>
        </p>
      ) : null}

      <SubmitButton mode={mode} />

      <p className="text-center text-sm text-muted">
        {isRegister ? (
          <>
            Already tracking your search?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/register" className="font-medium text-accent hover:underline">
              Create one
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  required,
  error,
  hint,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  required?: boolean;
  error?: string;
  hint?: string;
}) {
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} required={required}>
        {label}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        invalid={Boolean(error)}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

function SubmitButton({ mode }: { mode: Mode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      {pending
        ? mode === "login"
          ? "Signing in…"
          : "Creating account…"
        : mode === "login"
          ? "Sign in"
          : "Create account"}
    </Button>
  );
}
