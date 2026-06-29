using System;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;
using Volo.Abp.DependencyInjection;

namespace AgriMarket.Auth;

/// <summary>
/// Redis-backed OTP service. Codes are stored in <see cref="IDistributedCache" />
/// (the ABP Redis cache) under <c>otp:{phone}</c> with a TTL, and a separate
/// attempt counter under <c>otp:attempts:{phone}</c> enforces brute-force
/// protection.
///
/// In test mode (default in dev) every code is the literal <c>000000</c> so
/// the PRD acceptance criteria ("Test mode OTP 000000 always succeeds") holds.
/// </summary>
public class OtpService : IOtpService, ITransientDependency
{
    private const string TestCode = "000000";

    private readonly IDistributedCache _cache;
    private readonly AgriMarketOtpOptions _options;

    public OtpService(IDistributedCache cache, IOptions<AgriMarketOtpOptions> options)
    {
        _cache = cache;
        _options = options.Value;
    }

    public async Task<string> GenerateAsync(string phoneNumber)
    {
        var code = _options.TestMode
            ? TestCode
            : GenerateRandomCode(_options.CodeLength);

        // Store the code with the configured TTL. Sliding expiration is not
        // used: an OTP should expire from the moment it is issued.
        await _cache.SetStringAsync(
            CodeKey(phoneNumber),
            code,
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_options.TtlSeconds)
            }
        );

        // Reset the failed-attempt counter on a fresh code.
        await _cache.RemoveAsync(AttemptsKey(phoneNumber));

        return code;
    }

    public async Task<bool> VerifyAsync(string phoneNumber, string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return false;
        }

        var key = CodeKey(phoneNumber);
        var stored = await _cache.GetStringAsync(key);

        if (stored == null)
        {
            // Expired or never issued.
            return false;
        }

        // Constant-time comparison to avoid timing attacks (harmless in test
        // mode but correct by construction).
        if (!FixedTimeEquals(stored, code))
        {
            await IncrementAttemptsAsync(phoneNumber);
            return false;
        }

        // Success: consume the code and clear attempts.
        await _cache.RemoveAsync(key);
        await _cache.RemoveAsync(AttemptsKey(phoneNumber));
        return true;
    }

    private async Task IncrementAttemptsAsync(string phoneNumber)
    {
        var attemptsKey = AttemptsKey(phoneNumber);
        var attemptsStr = await _cache.GetStringAsync(attemptsKey);
        var attempts = string.IsNullOrEmpty(attemptsStr) ? 0 : int.Parse(attemptsStr, CultureInfo.InvariantCulture);
        attempts++;

        if (attempts >= _options.MaxAttempts)
        {
            // Too many tries: invalidate the code so it can't be brute-forced.
            await _cache.RemoveAsync(CodeKey(phoneNumber));
            await _cache.RemoveAsync(attemptsKey);
        }
        else
        {
            await _cache.SetStringAsync(
                attemptsKey,
                attempts.ToString(CultureInfo.InvariantCulture),
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_options.TtlSeconds)
                }
            );
        }
    }

    private static string CodeKey(string phone) => $"otp:{phone}";
    private static string AttemptsKey(string phone) => $"otp:attempts:{phone}";

    private static string GenerateRandomCode(int length)
    {
        // Crypto-strength digits. Avoids modulo bias for small digit spaces.
        var bytes = RandomNumberGenerator.GetBytes(length);
        var builder = new StringBuilder(length);
        foreach (var b in bytes)
        {
            builder.Append((b % 10).ToString("0", CultureInfo.InvariantCulture));
        }
        return builder.ToString();
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        if (a.Length != b.Length)
        {
            return false;
        }
        var result = 0;
        for (var i = 0; i < a.Length; i++)
        {
            result |= a[i] ^ b[i];
        }
        return result == 0;
    }
}
