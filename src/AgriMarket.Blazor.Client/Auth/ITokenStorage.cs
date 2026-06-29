using System.Threading.Tasks;

namespace AgriMarket.Blazor.Client.Auth;

/// <summary>
/// Stores the phone-OTP access token client-side (localStorage in WASM).
/// Abstracted behind an interface so the auth provider and HTTP handler
/// share one source of truth and can be swapped in tests.
/// </summary>
public interface ITokenStorage
{
    Task<string?> GetAccessTokenAsync();
    Task SetAccessTokenAsync(string? token);
    Task ClearAsync();
}
