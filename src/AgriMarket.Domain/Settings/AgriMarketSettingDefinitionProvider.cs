using Volo.Abp.Settings;

namespace AgriMarket.Settings;

public class AgriMarketSettingDefinitionProvider : SettingDefinitionProvider
{
    public override void Define(ISettingDefinitionContext context)
    {
        //Define your own settings here. Example:
        //context.Add(new SettingDefinition(AgriMarketSettings.MySetting1));
    }
}
