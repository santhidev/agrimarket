using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using AgriMarket.Maui.Core.Auth;

namespace AgriMarket.Maui.Auth;

/// <summary>
/// Attaches the stored JWT as <c>Authorization: Bearer &lt;token&gt;</c>
/// on every outbound API request when a token is present.
/// Mirrors <c>AuthenticatingHttpMessageHandler</c> from the Blazor client.
/// </summary>
public sealed class AuthenticatingHttpMessageHandler : DelegatingHandler
{
    private readonly ITokenStorage _tokenStorage;

    public AuthenticatingHttpMessageHandler(ITokenStorage tokenStorage)
    {
        _tokenStorage = tokenStorage;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var token = await _tokenStorage.GetAccessTokenAsync();
        if (!string.IsNullOrEmpty(token))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        return await base.SendAsync(request, cancellationToken);
    }
}
