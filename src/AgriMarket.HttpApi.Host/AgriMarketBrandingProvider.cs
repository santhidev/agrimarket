using Microsoft.Extensions.Localization;
using AgriMarket.Localization;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Ui.Branding;

namespace AgriMarket;

[Dependency(ReplaceServices = true)]
public class AgriMarketBrandingProvider : DefaultBrandingProvider
{
    private IStringLocalizer<AgriMarketResource> _localizer;

    public AgriMarketBrandingProvider(IStringLocalizer<AgriMarketResource> localizer)
    {
        _localizer = localizer;
    }

    public override string AppName => _localizer["AppName"];
}
