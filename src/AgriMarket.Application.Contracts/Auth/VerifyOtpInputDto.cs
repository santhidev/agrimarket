using System.ComponentModel.DataAnnotations;

namespace AgriMarket.Auth;

public class VerifyOtpInputDto
{
    [Required]
    [RegularExpression(@"^0\d{8,9}$", ErrorMessage = "Invalid phone number format.")]
    public string PhoneNumber { get; set; } = default!;

    [Required]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "OTP must be 6 digits.")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "OTP must be 6 digits.")]
    public string Code { get; set; } = default!;

    /// <summary>Optional FCM push token to register on login (Issue 13).</summary>
    public string? FcmToken { get; set; }
}
