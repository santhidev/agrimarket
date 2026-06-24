using Volo.Abp.Modularity;

namespace AgriMarket;

[DependsOn(
    typeof(AgriMarketApplicationModule),
    typeof(AgriMarketDomainTestModule)
)]
public class AgriMarketApplicationTestModule : AbpModule
{

}
