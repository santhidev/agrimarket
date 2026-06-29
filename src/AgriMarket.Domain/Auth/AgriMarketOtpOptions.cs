namespace AgriMarket.Auth;

/// <summary>
/// OTP (one-time password) configuration for phone authentication.
/// </summary>
public class AgriMarketOtpOptions
{
    /// <summary>
    /// When true, every OTP is the literal <c>000000</c> (the PRD's test OTP).
    /// Should be false in production. Defaults to true for dev convenience.
    /// </summary>
    public bool TestMode { get; set; } = true;

    /// <summary>OTP length in digits. PRD test mode uses 6 digits.</summary>
    public int CodeLength { get; set; } = 6;

    /// <summary>How long an OTP stays valid, in seconds (default 5 minutes).</summary>
    public int TtlSeconds { get; set; } = 300;

    /// <summary>
    /// Max consecutive failed verify attempts per phone before the stored code
    /// is consumed/invalidated. Protects against brute force.
    /// </summary>
    public int MaxAttempts { get; set; } = 5;
}
