Status: done

## What to build

Phone OTP registration + login via Auth.js (NextAuth) with a custom Credentials provider. Endpoints `POST /api/auth/request-otp` (accepts phone, generates + stores OTP in Redis with TTL) and the provider's `authorize` callback validates phone+OTP and returns the user. Test mode OTP `000000`. JWT session strategy so the token persists across reloads. Login UI (phone input → OTP input → submit) and a logout control.

## Acceptance criteria

- [x] `POST /api/auth/request-otp` accepts phone, stores OTP in Redis (TTL 5 min)
- [x] Auth.js `authorize(phone, otp)` validates against Redis; OTP `000000` always succeeds in test mode
- [x] On success a JWT session is issued; reload keeps the user logged in
- [x] Find-or-create user by phone in the `users` table
- [x] Login page: phone input → request OTP → OTP input → login works end-to-end
- [x] Logout works
- [x] Vitest: OTP generation/verify (test mode, wrong code, consumed code); protected route redirects to login when unauthenticated

## Blocked by

01
