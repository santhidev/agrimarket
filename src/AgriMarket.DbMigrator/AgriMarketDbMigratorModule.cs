using AgriMarket.EntityFrameworkCore;
using Volo.Abp.Autofac;
using Volo.Abp.Modularity;

namespace AgriMarket.DbMigrator;

[DependsOn(
    typeof(AbpAutofacModule),
    typeof(AgriMarketEntityFrameworkCoreModule),
    typeof(AgriMarketApplicationContractsModule)
    )]
public class AgriMarketDbMigratorModule : AbpModule
{
}
