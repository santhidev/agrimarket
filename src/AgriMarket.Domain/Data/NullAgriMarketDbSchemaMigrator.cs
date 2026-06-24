using System.Threading.Tasks;
using Volo.Abp.DependencyInjection;

namespace AgriMarket.Data;

/* This is used if database provider does't define
 * IAgriMarketDbSchemaMigrator implementation.
 */
public class NullAgriMarketDbSchemaMigrator : IAgriMarketDbSchemaMigrator, ITransientDependency
{
    public Task MigrateAsync()
    {
        return Task.CompletedTask;
    }
}
