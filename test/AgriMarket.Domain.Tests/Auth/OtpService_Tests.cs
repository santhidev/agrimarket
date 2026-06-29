using System;
using System.Threading.Tasks;
using AgriMarket.Auth;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Volo.Abp.Modularity;
using Xunit;

namespace AgriMarket.Auth;

/// <summary>
/// Pure logic tests for <see cref="OtpService" />. The default
/// <see cref="IDistributedCache" /> in the test host is an in-memory cache,
/// which is sufficient — Redis specifics are exercised at runtime against the
/// real container.
/// </summary>
public abstract class OtpService_Tests<TStartupModule> : AgriMarketDomainTestBase<TStartupModule>
    where TStartupModule : IAbpModule
{
    // Each test uses a distinct phone so the shared Redis cache (when active)
    // does not leak state across tests run in any order.
    private const string Phone = "0812345678";
    private const string Phone2 = "0812345679";
    private const string Phone3 = "0812345680";
    private const string Phone4 = "0812345681";
    private const string Phone5 = "0812345682";

    [Fact]
    public async Task Test_Mode_Should_Always_Return_000000()
    {
        var service = GetService();
        var code = await service.GenerateAsync(Phone);

        code.ShouldBe("000000");
    }

    [Fact]
    public async Task Test_Mode_Verify_000000_Should_Succeed()
    {
        var service = GetService();
        await service.GenerateAsync(Phone2);

        var ok = await service.VerifyAsync(Phone2, "000000");

        ok.ShouldBeTrue();
    }

    [Fact]
    public async Task Verify_Should_Consume_The_Code()
    {
        var service = GetService();
        await service.GenerateAsync(Phone3);

        (await service.VerifyAsync(Phone3, "000000")).ShouldBeTrue();
        // Second attempt on the consumed code must fail.
        (await service.VerifyAsync(Phone3, "000000")).ShouldBeFalse();
    }

    [Fact]
    public async Task Verify_Wrong_Code_Should_Fail()
    {
        var service = GetService();
        await service.GenerateAsync(Phone4);

        (await service.VerifyAsync(Phone4, "123456")).ShouldBeFalse();
    }

    [Fact]
    public async Task Verify_Without_Prior_Generate_Should_Fail()
    {
        var service = GetService();

        (await service.VerifyAsync(Phone5, "000000")).ShouldBeFalse();
    }

    [Fact]
    public async Task Null_Or_Empty_Code_Should_Fail()
    {
        var service = GetService();
        await service.GenerateAsync(Phone);

        (await service.VerifyAsync(Phone, "")).ShouldBeFalse();
        (await service.VerifyAsync(Phone, null!)).ShouldBeFalse();
    }

    private IOtpService GetService()
    {
        // Force test mode regardless of config so these tests are deterministic.
        var options = ServiceProvider.GetRequiredService<Microsoft.Extensions.Options.IOptions<AgriMarketOtpOptions>>();
        options.Value.TestMode = true;
        return ServiceProvider.GetRequiredService<IOtpService>();
    }
}
