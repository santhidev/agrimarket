namespace AgriMarket.Auth;

public class VerifyOtpResultDto
{
    /// <summary>JWT access token (HS256). Send as <c>Authorization: Bearer</c>.</summary>
    public string AccessToken { get; set; } = default!;

    /// <summary>Token lifetime in seconds.</summary>
    public int ExpiresIn { get; set; }

    /// <summary>The authenticated user.</summary>
    public CurrentUserDto User { get; set; } = default!;
}
