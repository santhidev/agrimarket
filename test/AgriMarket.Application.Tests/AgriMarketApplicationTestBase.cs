using Volo.Abp.Modularity;

namespace AgriMarket;

public abstract class AgriMarketApplicationTestBase<TStartupModule> : AgriMarketTestBase<TStartupModule>
    where TStartupModule : IAbpModule
{

}
