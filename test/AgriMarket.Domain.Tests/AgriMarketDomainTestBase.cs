using Volo.Abp.Modularity;

namespace AgriMarket;

/* Inherit from this class for your domain layer tests. */
public abstract class AgriMarketDomainTestBase<TStartupModule> : AgriMarketTestBase<TStartupModule>
    where TStartupModule : IAbpModule
{

}
