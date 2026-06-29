using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp;
using Volo.Abp.EntityFrameworkCore;
using Volo.Abp.EntityFrameworkCore.Sqlite;
using Volo.Abp.FeatureManagement;
using Volo.Abp.Modularity;
using Volo.Abp.PermissionManagement;
using Volo.Abp.SettingManagement;
using Volo.Abp.Uow;

namespace AgriMarket.EntityFrameworkCore;

[DependsOn(
    typeof(AgriMarketApplicationTestModule),
    typeof(AgriMarketEntityFrameworkCoreModule),
    typeof(AbpEntityFrameworkCoreSqliteModule)
    )]
public class AgriMarketEntityFrameworkCoreTestModule : AbpModule
{
    private SqliteConnection? _sqliteConnection;

    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        Configure<FeatureManagementOptions>(options =>
        {
            options.SaveStaticFeaturesToDatabase = false;
            options.IsDynamicFeatureStoreEnabled = false;
        });
        Configure<PermissionManagementOptions>(options =>
        {
            options.SaveStaticPermissionsToDatabase = false;
            options.IsDynamicPermissionStoreEnabled = false;
        });
        Configure<SettingManagementOptions>(options =>
        {
            options.SaveStaticSettingsToDatabase = false;
            options.IsDynamicSettingStoreEnabled = false;
        });
        context.Services.AddAlwaysDisableUnitOfWorkTransaction();

        // The OTP service uses IDistributedCache. ABP's Redis cache module
        // (AbpCachingStackExchangeRedisModule) is active here, so point it at
        // a Redis instance for tests. Replace with an in-memory cache if you
        // want fully isolated tests (no Redis dependency).
        context.Services.Configure<Microsoft.Extensions.Caching.StackExchangeRedis.RedisCacheOptions>(options =>
        {
            options.Configuration = "localhost:6379";
            options.InstanceName = "AgriMarket.Tests";
        });

        // JWT issuance needs a signing key; supply a test key (must be >= 32
        // chars for HS256). OTP test mode is forced in tests.
        Configure<AgriMarket.Auth.JwtOptions>(options =>
        {
            options.Issuer = "AgriMarket.Tests";
            options.Audience = "AgriMarket.Tests";
            options.SigningKey = "AgriMarket_Tests_Signing_Key_At_Least_32_Chars!";
            options.ExpiresMinutes = 60;
        });

        ConfigureInMemorySqlite(context.Services);
    }

    private void ConfigureInMemorySqlite(IServiceCollection services)
    {
        _sqliteConnection = CreateDatabaseAndGetConnection();

        services.Configure<AbpDbContextOptions>(options =>
        {
            options.Configure(context =>
            {
                context.DbContextOptions.UseSqlite(_sqliteConnection);
            });
        });
    }

    public override void OnApplicationShutdown(ApplicationShutdownContext context)
    {
        _sqliteConnection?.Dispose();
    }

    private static SqliteConnection CreateDatabaseAndGetConnection()
    {
        var connection = new AbpUnitTestSqliteConnection("Data Source=:memory:");
        connection.Open();

        var options = new DbContextOptionsBuilder<AgriMarketDbContext>()
            .UseSqlite(connection)
            .Options;

        using (var context = new AgriMarketDbContext(options))
        {
            context.GetService<IRelationalDatabaseCreator>().CreateTables();
        }

        return connection;
    }
}
