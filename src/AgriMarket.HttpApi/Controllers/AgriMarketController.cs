using AgriMarket.Localization;
using Volo.Abp.AspNetCore.Mvc;

namespace AgriMarket.Controllers;

/* Inherit your controllers from this class.
 */
public abstract class AgriMarketController : AbpControllerBase
{
    protected AgriMarketController()
    {
        LocalizationResource = typeof(AgriMarketResource);
    }
}
