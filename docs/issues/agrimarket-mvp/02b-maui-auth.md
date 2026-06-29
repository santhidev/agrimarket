Status: done

## What to build

MAUI login screen (phone input → OTP input → login) for `agri-mobile`, reusing the `/api/app/auth/request-otp` + `/verify-otp` endpoints from Issue 02. Includes creating the MAUI project (no `mobile/AgriMarket.Maui` exists yet — see PROJECT-BOOTSTRAP.md line 45) and Android tooling setup.

## Acceptance criteria

- [ ] `src/mobile/AgriMarket.Maui` MAUI project created and added to `AgriMarket.slnx`
- [ ] MAUI login page (phone → OTP → token) calling the existing auth endpoints
- [ ] Token stored securely (Microsoft.Maui.Storage.SecureStorage)
- [ ] Authenticated state persisted across app launches
- [ ] App compiles and runs on Android emulator
- [ ] Unit tests: login view model

## Blocked by

02

## Comments

### Spinoff — 2026-06-29

Extracted from Issue 02, which implemented backend + Blazor client. The MAUI project did not exist and creating it (project scaffold + Android tooling + build config) was out of scope for Issue 02. The auth backend endpoints are ready to consume.
