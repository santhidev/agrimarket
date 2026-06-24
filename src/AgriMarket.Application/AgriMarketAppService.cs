using System;
using System.Collections.Generic;
using System.Text;
using AgriMarket.Localization;
using Volo.Abp.Application.Services;

namespace AgriMarket;

/* Inherit your application services from this class.
 */
public abstract class AgriMarketAppService : ApplicationService
{
    protected AgriMarketAppService()
    {
        LocalizationResource = typeof(AgriMarketResource);
    }
}
