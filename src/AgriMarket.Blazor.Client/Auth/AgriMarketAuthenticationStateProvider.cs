using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Components.Authorization;

namespace AgriMarket.Blazor.Client.Auth;

/// <summary>
/// Custom <see cref="AuthenticationStateProvider" /> for the phone-OTP flow.
/// Reads the JWT from <see cref="ITokenStorage" /> (localStorage) and exposes
/// the parsed claims as the current <see cref="AuthenticationState" />.
/// </summary>
public class AgriMarketAuthenticationStateProvider : AuthenticationStateProvider
{
    private readonly ITokenStorage _tokenStorage;

    public AgriMarketAuthenticationStateProvider(ITokenStorage tokenStorage)
    {
        _tokenStorage = tokenStorage;
    }

    public override async Task<AuthenticationState> GetAuthenticationStateAsync()
    {
        var token = await _tokenStorage.GetAccessTokenAsync();
        if (string.IsNullOrEmpty(token))
        {
            return new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity()));
        }

        var identity = ParseClaimsFromJwt(token);
        var principal = new ClaimsPrincipal(identity);
        return new AuthenticationState(principal);
    }

    /// <summary>Called by the login page after a successful verify-otp.</summary>
    public async Task MarkUserAsAuthenticatedAsync(string token)
    {
        await _tokenStorage.SetAccessTokenAsync(token);
        var identity = ParseClaimsFromJwt(token);
        NotifyAuthenticationStateChanged(
            Task.FromResult(new AuthenticationState(new ClaimsPrincipal(identity))));
    }

    /// <summary>Called by logout.</summary>
    public async Task MarkUserAsLoggedOutAsync()
    {
        await _tokenStorage.ClearAsync();
        NotifyAuthenticationStateChanged(
            Task.FromResult(new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity()))));
    }

    private static ClaimsIdentity ParseClaimsFromJwt(string jwt)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var token = handler.ReadJwtToken(jwt);
            return new ClaimsIdentity(token.Claims, "AgriMarketJwt");
        }
        catch (Exception)
        {
            // Malformed/expired token: treat as anonymous.
            return new ClaimsIdentity();
        }
    }
}
