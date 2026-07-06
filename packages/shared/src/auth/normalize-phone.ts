// Phone normalization for the phone-OTP login form.
//
// The login input shows a "+66" prefix, which signals international format to
// users; some type "812345678" (no leading 0), others "0812345678", and a few
// paste "+66812345678" / "66812345678". All are the same Thai mobile. The auth
// schema + DB store the canonical "0xxxxxxxxx" form, so normalize before
// validation.

const DIGITS_RE = /\D+/g;

/**
 * Normalize raw user input into the canonical Thai mobile form `0xxxxxxxxx`
 * (9-10 digits, leading 0). Returns null when the input cannot be interpreted
 * as a Thai mobile.
 *
 * Accepts:
 *   - `0812345678`  → `0812345678` (canonical, passes through)
 *   - `812345678`   → `0812345678` (missing leading 0 — common with +66 prefix)
 *   - `+66812345678`/`66812345678` → `0812345678` (international form)
 *   - `081-234-5678`, ` 0812 345 678 ` → `0812345678` (whitespace/dashes stripped)
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;

  let digits = raw.replace(DIGITS_RE, "");

  // Strip a country code: either a literal "66" prefix or "+66" already
  // removed by DIGITS_RE. Only strip when the remaining number is 9 digits
  // (i.e. a Thai mobile without its leading 0).
  if (digits.startsWith("66") && digits.length === 11) {
    digits = digits.slice(2);
  }

  // Add the leading 0 if the user typed without it (9 digits starting 6-9).
  if (digits.length === 9 && /^[6-9]/.test(digits)) {
    digits = "0" + digits;
  }

  // Final length gate: 9 (landline-like) or 10 (mobile) digits, leading 0.
  if (!/^0\d{8,9}$/.test(digits)) return null;

  return digits;
}
