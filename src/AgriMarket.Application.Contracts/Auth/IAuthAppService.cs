using System.Threading.Tasks;

namespace AgriMarket.Auth;

/// <summary>
/// Phone OTP authentication endpoints. Implemented by <c>AuthAppService</c>
/// and auto-exposed at <c>/api/auth/*</c> by ABP convention-based routing.
/// </summary>
public interface IAuthAppService
{
    /// <summary>
    /// Issue a one-time password for <paramref name="input" />. The code is
    /// stored server-side (Redis); test mode returns <c>000000</c>.
    /// </summary>
    Task<RequestOtpResultDto> RequestOtpAsync(RequestOtpInputDto input);

    /// <summary>
    /// Verify the OTP and issue a JWT access token. On success the user is
    /// found-or-created by phone number and the optional FCM token is saved.
    /// </summary>
    Task<VerifyOtpResultDto> VerifyOtpAsync(VerifyOtpInputDto input);
}
