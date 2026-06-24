using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using AgriMarket.Data;
using Volo.Abp.DependencyInjection;

namespace AgriMarket.EntityFrameworkCore;

public class EntityFrameworkCoreAgriMarketDbSchemaMigrator
    : IAgriMarketDbSchemaMigrator, ITransientDependency
{
    private readonly IServiceProvider _serviceProvider;

    public EntityFrameworkCoreAgriMarketDbSchemaMigrator(
        IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task MigrateAsync()
    {
        /* We intentionally resolve the AgriMarketDbContext
         * from IServiceProvider (instead of directly injecting it)
         * to properly get the connection string of the current tenant in the
         * current scope.
         */

        await _serviceProvider
            .GetRequiredService<AgriMarketDbContext>()
            .Database
            .MigrateAsync();
    }
}
