using AgriMarket.Localization;
using Volo.Abp.AspNetCore.Components;

namespace AgriMarket.Blazor.Client;

public abstract class AgriMarketComponentBase : AbpComponentBase
{
    protected AgriMarketComponentBase()
    {
        LocalizationResource = typeof(AgriMarketResource);
    }
}
