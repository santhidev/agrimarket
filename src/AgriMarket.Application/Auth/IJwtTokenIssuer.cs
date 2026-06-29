using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Identity;

namespace AgriMarket.Auth;

/// <summary>
/// Issues JWT access tokens for authenticated users. Decoupled from
/// <c>AuthAppService</c> so it can be unit-tested independently of OTP logic.
/// </summary>
public interface IJwtTokenIssuer
{
    /// <summary>
    /// Build a signed JWT for <paramref name="user" /> with the given
    /// additional role claims. Returns the serialized token and its
    /// expiry (UTC).
    /// </summary>
    Task<(string Token, DateTime ExpiresAtUtc)> IssueAsync(IdentityUser user, IEnumerable<string> roles);
}
