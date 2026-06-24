Status: ready-for-agent

## What to build

Phone OTP registration + login flow using ABP Identity with custom PhoneOtpProvider. User registers with phone number, receives OTP (test mode: 000000), verifies → JWT token. FCM token registered on login. Blazor WASM login screen + MAUI login screen.

## Acceptance criteria

- [ ] POST /auth/request-otp accepts phone, generates OTP
- [ ] POST /auth/verify-otp accepts phone+otp, returns access_token + user
- [ ] Test mode OTP 000000 always succeeds
- [ ] JWT token returned with correct claims
- [ ] FCM token saved to users table on login
- [ ] Blazor WASM login screen works (phone input → OTP input → login)
- [ ] MAUI login screen works (phone input → OTP input → login)
- [ ] Unit tests: OTP generation, JWT claims, FCM token save

## Blocked by

01