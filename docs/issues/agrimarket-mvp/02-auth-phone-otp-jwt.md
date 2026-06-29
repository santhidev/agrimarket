Status: done

## What to build

Phone OTP registration + login flow using ABP Identity with custom PhoneOtpProvider. User registers with phone number, receives OTP (test mode: 000000), verifies → JWT token. FCM token registered on login. Blazor WASM login screen + MAUI login screen.

## Acceptance criteria

- [x] POST /auth/request-otp accepts phone, generates OTP
- [x] POST /auth/verify-otp accepts phone+otp, returns access_token + user
- [x] Test mode OTP 000000 always succeeds
- [x] JWT token returned with correct claims
- [x] FCM token saved to users table on login
- [x] Blazor WASM login screen works (phone input → OTP input → login)
- [ ] MAUI login screen works (phone input → OTP input → login) — deferred to Issue 02b
- [x] Unit tests: OTP generation, JWT claims, FCM token save

## Blocked by

01

## Comments

### Implementation — 2026-06-29

Implemented backend + Blazor client. MAUI login deferred to Issue 02b (no MAUI project exists yet).

**Design decisions** (per user):
- Token flow: custom JWT (HS256) issued by `/api/app/auth/verify-otp`, not via OpenIddict. Blazor switched from OIDC redirect to token-based auth.
- User model: AgriMarket columns added to `AbpUsers` via ABP `ObjectExtensionManager` (not a separate `AppUser : IdentityUser` entity — ABP 10 table-sharing broke the EF model; extra-properties is the canonical, stable approach). `AppUser` is a static facade of Get/Set extension methods over `IdentityUser.ExtraProperties`.
- OTP storage: Redis (`IDistributedCache`, key `otp:{phone}`, TTL 5 min, brute-force protection).

**What was built:**
- `AgriMarket.Domain/Auth/`: `AgriMarketOtpOptions`, `IOtpService`, `OtpService` (Redis, test mode `000000`).
- `AgriMarket.Domain/Users/`: `AppUser` (facade), `CreditTier`, `KycStatus` enums.
- `AgriMarket.Application/Auth/`: `JwtOptions`, `IJwtTokenIssuer`, `JwtTokenIssuer` (HS256), `AuthAppService` (request-otp, verify-otp, find-or-create user, FCM save).
- `AgriMarket.Application.Contracts/Auth/`: DTOs + `IAuthAppService`.
- Migration `AddAppUserAuth`: 9 new columns on `AbpUsers` (FcmToken, Tier, KycStatus, BuyerScore, SellerScore, IsAdmin, IsRider, IsHubStaff, HubId).
- Host: JWT bearer scheme (`AgriMarketJwt`) as default + `Jwt`/`Otp` config sections.
- `AgriMarket.Blazor.Client/Auth/`: custom `AuthenticationStateProvider`, `ITokenStorage` (localStorage), `AuthenticatingHttpMessageHandler`.
- `Pages/Auth/Login.razor`: 2-step Thai UI (เบอร์ → ขอรหัส → OTP → เข้าสู่ระบบ), MudBlazor.
- Tests (xUnit, 11 passing): OtpService logic + AuthAppService e2e (JWT claims, FCM persisted, wrong code rejected, reuse user).

**Verified at runtime:**
- `POST /api/app/auth/request-otp` → `{"expiresIn":300,"testCode":"000000"}` HTTP 200
- `POST /api/app/auth/verify-otp` → JWT + user object HTTP 200
- DB: user created, `PhoneNumber` + `FcmToken` saved, defaults (IsAdmin=false, Tier=None, KycStatus=None).
- `dotnet build` solution: 0 errors. `dotnet test`: 11 passed.

**Deferred to 02b:** MAUI login screen (MAUI project + Android tooling).