namespace AgriMarket.Auth;

/// <summary>
/// JWT signing/issuance configuration for the phone-OTP token endpoint.
/// Bound from the <c>Jwt</c> config section.
/// </summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>Token issuer (<c>iss</c> claim).</summary>
    public string Issuer { get; set; } = "AgriMarket";

    /// <summary>Token audience (<c>aud</c> claim).</summary>
    public string Audience { get; set; } = "AgriMarket";

    /// <summary>
    /// HMAC-SHA256 signing key. Must be at least 32 characters (256 bits).
    /// </summary>
    public string SigningKey { get; set; } = default!;

    /// <summary>Access token lifetime in minutes.</summary>
    public int ExpiresMinutes { get; set; } = 60;
}
