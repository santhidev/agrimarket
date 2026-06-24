using Volo.Abp.Modularity;

namespace AgriMarket;

[DependsOn(
    typeof(AgriMarketDomainModule),
    typeof(AgriMarketTestBaseModule)
)]
public class AgriMarketDomainTestModule : AbpModule
{

}
