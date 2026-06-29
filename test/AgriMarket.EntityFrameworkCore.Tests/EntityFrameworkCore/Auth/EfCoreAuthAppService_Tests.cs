using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using AgriMarket.EntityFrameworkCore;
using AgriMarket.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Xunit;

namespace AgriMarket.Auth;

/// <summary>
/// End-to-end auth flow tests against the SQLite-backed test host:
/// request-otp → verify-otp → JWT issued → user created → FCM token saved.
/// </summary>
[Collection(AgriMarketTestConsts.CollectionDefinitionName)]
public class EfCoreAuthAppService_Tests : AgriMarketEntityFrameworkCoreTestBase
{
    private const string Phone = "0812345678";
    private const string FcmToken = "test-fcm-token-abc";

    [Fact]
    public async Task Request_Otp_Should_Return_Expiry_And_Test_Code()
    {
        var service = GetAuthAppService();

        var result = await service.RequestOtpAsync(new RequestOtpInputDto { PhoneNumber = Phone });

        result.ExpiresIn.ShouldBeGreaterThan(0);
        result.TestCode.ShouldBe("000000");
    }

    [Fact]
    public async Task Verify_Otp_With_000000_Should_Issue_Token_And_Create_User()
    {
        var service = GetAuthAppService();
        await service.RequestOtpAsync(new RequestOtpInputDto { PhoneNumber = Phone });

        var result = await service.VerifyOtpAsync(new VerifyOtpInputDto
        {
            PhoneNumber = Phone,
            Code = "000000",
            FcmToken = FcmToken
        });

        result.AccessToken.ShouldNotBeNullOrEmpty();
        result.ExpiresIn.ShouldBeGreaterThan(0);
        result.User.ShouldNotBeNull();
        result.User.PhoneNumber.ShouldBe(Phone);
        result.User.UserName.ShouldBe(Phone);

        // The token must be a valid JWT with the expected claims.
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.AccessToken);
        jwt.Claims.ShouldContain(c => c.Type == JwtRegisteredClaimNames.Sub);
        jwt.Claims.ShouldContain(c => c.Type == ClaimTypes.Name && c.Value == Phone);
        jwt.Claims.ShouldContain(c => c.Type == JwtRegisteredClaimNames.PhoneNumber && c.Value == Phone);
    }

    [Fact]
    public async Task Verify_Otp_Should_Save_Fcm_Token()
    {
        var service = GetAuthAppService();
        await service.RequestOtpAsync(new RequestOtpInputDto { PhoneNumber = Phone });

        await service.VerifyOtpAsync(new VerifyOtpInputDto
        {
            PhoneNumber = Phone,
            Code = "000000",
            FcmToken = FcmToken
        });

        var repo = GetRequiredService<IRepository<IdentityUser, Guid>>();
        await WithUnitOfWorkAsync(async () =>
        {
            var user = await (await repo.GetQueryableAsync())
                .Where(u => u.UserName == Phone)
                .FirstOrDefaultAsync();
            user.ShouldNotBeNull();
            user.GetFcmToken().ShouldBe(FcmToken);
        });
    }

    [Fact]
    public async Task Verify_Otp_With_Wrong_Code_Should_Throw()
    {
        var service = GetAuthAppService();
        await service.RequestOtpAsync(new RequestOtpInputDto { PhoneNumber = Phone });

        await Should.ThrowAsync<UnauthorizedAccessException>(() =>
            service.VerifyOtpAsync(new VerifyOtpInputDto
            {
                PhoneNumber = Phone,
                Code = "999999"
            }));
    }

    [Fact]
    public async Task Repeated_Verify_Should_Reuse_Same_User()
    {
        var service = GetAuthAppService();

        // First login creates the user.
        await service.RequestOtpAsync(new RequestOtpInputDto { PhoneNumber = Phone });
        var first = await service.VerifyOtpAsync(new VerifyOtpInputDto
        {
            PhoneNumber = Phone,
            Code = "000000"
        });

        // Second login (new OTP) reuses the same user id.
        await service.RequestOtpAsync(new RequestOtpInputDto { PhoneNumber = Phone });
        var second = await service.VerifyOtpAsync(new VerifyOtpInputDto
        {
            PhoneNumber = Phone,
            Code = "000000"
        });

        second.User.Id.ShouldBe(first.User.Id);
    }

    private IAuthAppService GetAuthAppService()
    {
        // Ensure test mode is on (the SQLite host may not read appsettings).
        var options = ServiceProvider.GetRequiredService<
            Microsoft.Extensions.Options.IOptions<AgriMarketOtpOptions>>();
        options.Value.TestMode = true;
        return ServiceProvider.GetRequiredService<IAuthAppService>();
    }
}
