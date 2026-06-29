using AgriMarket.Localization;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.Localization;

namespace AgriMarket.Permissions;

public class AgriMarketPermissionDefinitionProvider : PermissionDefinitionProvider
{
    public override void Define(IPermissionDefinitionContext context)
    {
        var myGroup = context.AddGroup(AgriMarketPermissions.GroupName);

        var products = myGroup.AddPermission(AgriMarketPermissions.Products.Default, L("Permission:Products"));
        products.AddChild(AgriMarketPermissions.Products.Manage, L("Permission:Products.Manage"));
    }

    private static LocalizableString L(string name)
    {
        return LocalizableString.Create<AgriMarketResource>(name);
    }
}
