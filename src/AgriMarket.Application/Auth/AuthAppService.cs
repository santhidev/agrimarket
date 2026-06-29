using System;
using System.Linq;
using System.Threading.Tasks;
using AgriMarket.Users;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Volo.Abp.Guids;
using Volo.Abp.Identity;

namespace AgriMarket.Auth;

/// <summary>
/// Phone OTP authentication endpoints, auto-exposed at <c>/api/auth/*</c>.
///
/// <see cref="RequestOtpAsync"/> issues a code (test mode: <c>000000</c>);
/// <see cref="VerifyOtpAsync"/> validates it, finds-or-creates the user by
/// phone number, saves the FCM token, and returns a JWT.
/// </summary>
public class AuthAppService : AgriMarketAppService, IAuthAppService
{
    private readonly IOtpService _otpService;
    private readonly IJwtTokenIssuer _jwtIssuer;
    private readonly JwtOptions _jwtOptions;
    private readonly AgriMarketOtpOptions _otpOptions;
    private readonly IdentityUserManager _userManager;
    private readonly IGuidGenerator _guidGenerator;
    private readonly ILogger<AuthAppService> _logger;

    public AuthAppService(
        IOtpService otpService,
        IJwtTokenIssuer jwtIssuer,
        IOptions<JwtOptions> jwtOptions,
        IOptions<AgriMarketOtpOptions> otpOptions,
        IdentityUserManager userManager,
        IGuidGenerator guidGenerator,
        ILogger<AuthAppService> logger)
    {
        _otpService = otpService;
        _jwtIssuer = jwtIssuer;
        _jwtOptions = jwtOptions.Value;
        _otpOptions = otpOptions.Value;
        _userManager = userManager;
        _guidGenerator = guidGenerator;
        _logger = logger;
    }

    public async Task<RequestOtpResultDto> RequestOtpAsync(RequestOtpInputDto input)
    {
        var code = await _otpService.GenerateAsync(input.PhoneNumber);

        // MVP: no real SMS gateway. Log the code in dev so it can be used.
        _logger.LogInformation("OTP issued for {Phone}: {Code}", input.PhoneNumber, code);

        return new RequestOtpResultDto
        {
            ExpiresIn = _otpOptions.TtlSeconds,
            // Only expose the code to clients in test mode (no SMS available).
            TestCode = _otpOptions.TestMode ? code : null
        };
    }

    public async Task<VerifyOtpResultDto> VerifyOtpAsync(VerifyOtpInputDto input)
    {
        var ok = await _otpService.VerifyAsync(input.PhoneNumber, input.Code);
        if (!ok)
        {
            throw new UnauthorizedAccessException("Invalid or expired OTP.");
        }

        var user = await FindOrCreateUserAsync(input.PhoneNumber);

        // Save the FCM push token if the client supplied one (Issue 13).
        if (!string.IsNullOrWhiteSpace(input.FcmToken))
        {
            user.SetFcmToken(input.FcmToken);
            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                var errors = string.Join(", ", updateResult.Errors.Select(e => e.Description));
                _logger.LogWarning("Failed to save FCM token for {Phone}: {Errors}", input.PhoneNumber, errors);
            }
        }

        var roles = await _userManager.GetRolesAsync(user);
        var (token, expiresAtUtc) = await _jwtIssuer.IssueAsync(user, roles);

        return new VerifyOtpResultDto
        {
            AccessToken = token,
            ExpiresIn = (int)(expiresAtUtc - DateTime.UtcNow).TotalSeconds,
            User = new CurrentUserDto
            {
                Id = user.Id,
                UserName = user.UserName!,
                PhoneNumber = user.PhoneNumber ?? input.PhoneNumber,
                Tier = user.GetTier(),
                KycStatus = user.GetKycStatus(),
                IsAdmin = user.GetIsAdmin()
            }
        };
    }

    private async Task<IdentityUser> FindOrCreateUserAsync(string phoneNumber)
    {
        // Phone-as-username: the phone is the UserName (see AgriMarketDataSeeder).
        var existing = await _userManager.FindByNameAsync(phoneNumber);
        if (existing != null)
        {
            return existing;
        }

        var user = new IdentityUser(
            _guidGenerator.Create(),
            phoneNumber,
            phoneNumber + "@agrimarket.local"
        );
        user.SetIsActive(true);

        var createResult = await _userManager.CreateAsync(user);
        if (!createResult.Succeeded)
        {
            var errors = string.Join(", ", createResult.Errors.Select(e => e.Description));
            throw new InvalidOperationException($"Failed to create user for phone {phoneNumber}: {errors}");
        }

        // Store the phone number in the dedicated column as well.
        await _userManager.SetPhoneNumberAsync(user, phoneNumber);

        return user;
    }
}
