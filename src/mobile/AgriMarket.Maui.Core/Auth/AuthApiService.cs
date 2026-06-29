using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using AgriMarket.Maui.Core.Models;

namespace AgriMarket.Maui.Core.Auth;

/// <summary>
/// HTTP-based implementation of <see cref="IAuthApiService" />. Uses a
/// plain <c>HttpClient</c> (no ABP dynamic proxy) to call the REST
/// endpoints exposed by <c>AuthAppService</c>.
/// </summary>
public sealed class AuthApiService : IAuthApiService
{
    private readonly HttpClient _httpClient;

    public AuthApiService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<RequestOtpResponse> RequestOtpAsync(string phoneNumber, CancellationToken cancellationToken = default)
    {
        var response = await _httpClient.PostAsJsonAsync(
            "api/app/auth/request-otp",
            new RequestOtpRequest { PhoneNumber = phoneNumber },
            cancellationToken);

        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<RequestOtpResponse>(cancellationToken: cancellationToken);
        return result ?? throw new InvalidOperationException("Empty response from request-otp.");
    }

    public async Task<VerifyOtpResponse> VerifyOtpAsync(string phoneNumber, string code, string? fcmToken = null, CancellationToken cancellationToken = default)
    {
        var response = await _httpClient.PostAsJsonAsync(
            "api/app/auth/verify-otp",
            new VerifyOtpRequest { PhoneNumber = phoneNumber, Code = code, FcmToken = fcmToken },
            cancellationToken);

        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<VerifyOtpResponse>(cancellationToken: cancellationToken);
        return result ?? throw new InvalidOperationException("Empty response from verify-otp.");
    }
}
