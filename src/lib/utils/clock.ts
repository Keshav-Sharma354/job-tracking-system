/**
 * Request-time clock.
 *
 * Reading the clock inside a component body is an impure operation, and React's
 * compiler rightly refuses it: a client component must produce the same output
 * for the same props. Server components are rendered once per request, so a
 * timestamp captured there is correct — but it has to be captured explicitly and
 * threaded down as data so every card on a page agrees on what "now" means.
 *
 * Calling `captureNow()` from the server component root and passing the result
 * down keeps the render pure and makes the time source visible.
 */
export function captureNow(): number {
  return Date.now();
}
