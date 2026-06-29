namespace AgriMarket.Maui.Core.Auth;

/// <summary>
/// Stores the phone-OTP access token. Implemented with
/// <c>SecureStorage</c> in the MAUI app; mocked in tests.
/// </summary>
public interface ITokenStorage
{
    Task<string?> GetAccessTokenAsync();
    Task SetAccessTokenAsync(string? token);
    Task ClearAsync();
}
