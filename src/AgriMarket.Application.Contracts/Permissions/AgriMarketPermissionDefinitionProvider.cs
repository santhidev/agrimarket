using AgriMarket.Localization;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.Localization;

namespace AgriMarket.Permissions;

public class AgriMarketPermissionDefinitionProvider : PermissionDefinitionProvider
{
    public override void Define(IPermissionDefinitionContext context)
    {
        var myGroup = context.AddGroup(AgriMarketPermissions.GroupName);
        //Define your own permissions here. Example:
        //myGroup.AddPermission(AgriMarketPermissions.MyPermission1, L("Permission:MyPermission1"));
    }

    private static LocalizableString L(string name)
    {
        return LocalizableString.Create<AgriMarketResource>(name);
    }
}
