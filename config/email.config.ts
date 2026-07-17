import { Resend } from "resend";

export const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@allfix.space";

// Lazy-initialize so a missing key never crashes the server on startup.
// Email sending will fail gracefully at call-time if the key is not set.
let _resend: Resend | null = null;

export function getResendClient(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.startsWith("re_placeholder")) {
      console.warn(
        "[email] RESEND_API_KEY is not set or is a placeholder. " +
        "Email sending will be skipped. Set a real key in .env to enable emails."
      );
    }
    _resend = new Resend(apiKey || "re_placeholder");
  }
  return _resend;
}

// Legacy alias kept for backwards-compat with any files that import { resend }
export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return (getResendClient() as any)[prop];
  },
});