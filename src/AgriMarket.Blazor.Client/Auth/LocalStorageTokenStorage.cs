using System.Threading.Tasks;
using Microsoft.JSInterop;

namespace AgriMarket.Blazor.Client.Auth;

/// <summary>
/// localStorage-backed token storage for Blazor WebAssembly.
/// </summary>
public class LocalStorageTokenStorage : ITokenStorage
{
    private const string AccessTokenKey = "agrimarket.access_token";

    private readonly IJSRuntime _js;

    public LocalStorageTokenStorage(IJSRuntime js)
    {
        _js = js;
    }

    public async Task<string?> GetAccessTokenAsync()
    {
        return await _js.InvokeAsync<string?>("localStorage.getItem", AccessTokenKey);
    }

    public async Task SetAccessTokenAsync(string? token)
    {
        if (string.IsNullOrEmpty(token))
        {
            await _js.InvokeVoidAsync("localStorage.removeItem", AccessTokenKey);
        }
        else
        {
            await _js.InvokeVoidAsync("localStorage.setItem", AccessTokenKey, token);
        }
    }

    public async Task ClearAsync()
    {
        await _js.InvokeVoidAsync("localStorage.removeItem", AccessTokenKey);
    }
}
