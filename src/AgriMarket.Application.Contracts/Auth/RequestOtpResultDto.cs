namespace AgriMarket.Auth;

public class RequestOtpResultDto
{
    /// <summary>Seconds until the issued OTP expires.</summary>
    public int ExpiresIn { get; set; }

    /// <summary>
    /// The OTP code. Only populated in test mode (dev) so clients can display
    /// it without an SMS gateway. Null in production.
    /// </summary>
    public string? TestCode { get; set; }
}
