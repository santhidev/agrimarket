using System.Text.Json.Serialization;

namespace AgriMarket.Maui.Core.Models;

/// <summary>
/// Lightweight DTOs mirroring the backend auth API contracts
/// (POST /api/app/auth/request-otp, POST /api/app/auth/verify-otp).
/// JSON property names are camelCase to match the ABP / ASP.NET Core
/// serialization defaults on the server.
/// </summary>

public sealed class RequestOtpRequest
{
    [JsonPropertyName("phoneNumber")]
    public string PhoneNumber { get; set; } = string.Empty;
}

public sealed class RequestOtpResponse
{
    [JsonPropertyName("expiresIn")]
    public int ExpiresIn { get; set; }

    /// <summary>Only populated in test mode (dev). Null in production.</summary>
    [JsonPropertyName("testCode")]
    public string? TestCode { get; set; }
}

public sealed class VerifyOtpRequest
{
    [JsonPropertyName("phoneNumber")]
    public string PhoneNumber { get; set; } = string.Empty;

    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("fcmToken")]
    public string? FcmToken { get; set; }
}

public sealed class VerifyOtpResponse
{
    [JsonPropertyName("accessToken")]
    public string AccessToken { get; set; } = string.Empty;

    [JsonPropertyName("expiresIn")]
    public int ExpiresIn { get; set; }

    [JsonPropertyName("user")]
    public CurrentUserDto User { get; set; } = new();
}

public sealed class CurrentUserDto
{
    [JsonPropertyName("id")]
    public Guid Id { get; set; }

    [JsonPropertyName("userName")]
    public string UserName { get; set; } = string.Empty;

    [JsonPropertyName("phoneNumber")]
    public string PhoneNumber { get; set; } = string.Empty;

    [JsonPropertyName("tier")]
    public int Tier { get; set; }

    [JsonPropertyName("kycStatus")]
    public int KycStatus { get; set; }

    [JsonPropertyName("isAdmin")]
    public bool IsAdmin { get; set; }
}
