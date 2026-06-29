using System.Threading.Tasks;
using AgriMarket.Maui.Core.Auth;
using Microsoft.Maui.Storage;

namespace AgriMarket.Maui.Auth;

/// <summary>
/// <see cref="ITokenStorage" /> backed by MAUI <c>SecureStorage</c>.
/// On Android this uses the Android Keystore; on Windows it uses DPAPI.
/// The token persists across app launches.
/// </summary>
public sealed class SecureStorageTokenStorage : ITokenStorage
{
    private const string AccessTokenKey = "agrimarket.access_token";

    public async Task<string?> GetAccessTokenAsync()
    {
        return await SecureStorage.GetAsync(AccessTokenKey);
    }

    public async Task SetAccessTokenAsync(string? token)
    {
        if (string.IsNullOrEmpty(token))
        {
            SecureStorage.Remove(AccessTokenKey);
        }
        else
        {
            await SecureStorage.SetAsync(AccessTokenKey, token);
        }
    }

    public Task ClearAsync()
    {
        SecureStorage.Remove(AccessTokenKey);
        return Task.CompletedTask;
    }
}
