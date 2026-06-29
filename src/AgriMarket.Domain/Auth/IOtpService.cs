using System.Threading.Tasks;

namespace AgriMarket.Auth;

/// <summary>
/// Generates and verifies one-time passwords for phone authentication.
/// Implementations store the code with a TTL (see <see cref="AgriMarketOtpOptions"/>).
/// </summary>
public interface IOtpService
{
    /// <summary>
    /// Generate and store an OTP for <paramref name="phoneNumber" />,
    /// overwriting any previous code. Returns the code (test mode returns
    /// <c>000000</c>).
    /// </summary>
    Task<string> GenerateAsync(string phoneNumber);

    /// <summary>
    /// Verify a code against the stored OTP for <paramref name="phoneNumber" />.
    /// Consumes the code on success. Returns false if the code is wrong,
    /// expired, or already consumed.
    /// </summary>
    Task<bool> VerifyAsync(string phoneNumber, string code);
}
