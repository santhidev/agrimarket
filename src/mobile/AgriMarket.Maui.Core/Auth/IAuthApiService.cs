using AgriMarket.Maui.Core.Models;

namespace AgriMarket.Maui.Core.Auth;

/// <summary>
/// Client for the backend auth endpoints. Wraps the HTTP calls so the
/// login view model can stay fully testable with a mock.
/// </summary>
public interface IAuthApiService
{
    /// <summary>POST /api/app/auth/request-otp</summary>
    Task<RequestOtpResponse> RequestOtpAsync(string phoneNumber, CancellationToken cancellationToken = default);

    /// <summary>POST /api/app/auth/verify-otp</summary>
    Task<VerifyOtpResponse> VerifyOtpAsync(string phoneNumber, string code, string? fcmToken = null, CancellationToken cancellationToken = default);
}
