using System.ComponentModel.DataAnnotations;

namespace AgriMarket.Auth;

public class RequestOtpInputDto
{
    /// <summary>Thai mobile number, e.g. 0812345678. Digits only.</summary>
    [Required]
    [RegularExpression(@"^0\d{8,9}$", ErrorMessage = "Invalid phone number format.")]
    public string PhoneNumber { get; set; } = default!;
}
