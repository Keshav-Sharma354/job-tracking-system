"use client";

import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/utils/result";

/**
 * Wraps a server action with pending state, error surfacing and a success toast.
 *
 * Every mutation in the app goes through this so the UX is consistent: a single
 * in-flight flag per action, field errors preserved for the form to render, and
 * failures shown as a toast rather than an unhandled promise rejection.
 */
export function useServerAction<A extends unknown[], R extends ActionResult<unknown>>(
  action: (...args: A) => Promise<R>,
  options: {
    /** Shown as a success toast when the action returns ok and gives no message. */
    successMessage?: string;
    onSuccess?: (result: Extract<R, { ok: true }>) => void;
    onError?: (result: Extract<R, { ok: false }>) => void;
  } = {},
) {
  const [pending, setPending] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // Latest props, read at call time. Kept in a ref rather than in the
  // dependency list so `run` stays stable across renders — otherwise every
  // inline callback in a consumer would be recreated each render.
  const latest = React.useRef({ action, options });

  React.useEffect(() => {
    latest.current = { action, options };
  });

  const run = React.useCallback(async (...args: A): Promise<R | null> => {
    setPending(true);
    setFieldErrors({});
    try {
      const result = await latest.current.action(...args);

      if (result.ok) {
        if (result.message) {
          toast.success(result.message);
        } else if (latest.current.options.successMessage) {
          toast.success(latest.current.options.successMessage);
        }
        latest.current.options.onSuccess?.(result as Extract<R, { ok: true }>);
      } else {
        // A validation failure belongs on the field, not in a toast that the
        // user has to dismiss before they can see the message.
        if (result.code === "VALIDATION" && result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        } else {
          toast.error(result.error);
        }
        latest.current.options.onError?.(result as Extract<R, { ok: false }>);
      }

      return result;
    } catch (error) {
      // A thrown error is a bug or an infrastructure failure, not an expected
      // result; log it so it reaches error tracking.
      console.error("Server action failed", error);
      toast.error("Something went wrong. Please try again.");
      return null;
    } finally {
      setPending(false);
    }
  }, []);

  return {
    run,
    pending,
    fieldErrors,
    clearFieldErrors: React.useCallback(() => setFieldErrors({}), []),
  };
}
