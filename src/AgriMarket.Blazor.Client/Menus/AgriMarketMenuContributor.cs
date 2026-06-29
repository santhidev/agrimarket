using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using AgriMarket.Localization;
using AgriMarket.MultiTenancy;
using Volo.Abp.Account.Localization;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.Identity.Blazor.MudBlazor;
using Volo.Abp.SettingManagement.Blazor.MudBlazor.Menus;
using Volo.Abp.TenantManagement.Blazor.MudBlazor.Navigation;
using Volo.Abp.UI.Navigation;

namespace AgriMarket.Blazor.Client.Menus;

public class AgriMarketMenuContributor : IMenuContributor
{
    private readonly IConfiguration _configuration;

    public AgriMarketMenuContributor(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task ConfigureMenuAsync(MenuConfigurationContext context)
    {
        if (context.Menu.Name == StandardMenus.Main)
        {
            await ConfigureMainMenuAsync(context);
        }
        else if (context.Menu.Name == StandardMenus.User)
        {
            await ConfigureUserMenuAsync(context);
        }
    }

    private Task ConfigureMainMenuAsync(MenuConfigurationContext context)
    {
        var l = context.GetLocalizer<AgriMarketResource>();

        context.Menu.Items.Insert(
            0,
            new ApplicationMenuItem(
                AgriMarketMenus.Home,
                l["Menu:Home"],
                "/",
                icon: "fas fa-home"
            )
        );

        // Catalog menu — product browse + admin management.
        var catalog = new ApplicationMenuItem(
            AgriMarketMenus.Catalog,
            l["Menu:Catalog"],
            icon: "fas fa-leaf"
        );
        catalog.AddItem(new ApplicationMenuItem(
            AgriMarketMenus.Products,
            l["Menu:Products"],
            "/catalog/products",
            icon: "fas fa-apple-alt"
        ));
        catalog.AddItem(new ApplicationMenuItem(
            AgriMarketMenus.ProductManagement,
            l["Permission:Products.Manage"],
            "/catalog/product-management",
            icon: "fas fa-cogs"
        ).RequirePermissions("AgriMarket.Products.Manage"));
        context.Menu.Items.Insert(1, catalog);

        var administration = context.Menu.GetAdministration();

        if (MultiTenancyConsts.IsEnabled)
        {
            administration.SetSubItemOrder(TenantManagementMenuNames.GroupName, 1);
        }
        else
        {
            administration.TryRemoveMenuItem(TenantManagementMenuNames.GroupName);
        }

        administration.SetSubItemOrder(IdentityMenuNames.GroupName, 2);
        administration.SetSubItemOrder(SettingManagementMenus.GroupName, 3);

        return Task.CompletedTask;
    }

    private Task ConfigureUserMenuAsync(MenuConfigurationContext context)
    {
        var accountStringLocalizer = context.GetLocalizer<AccountResource>();

        var authServerUrl = _configuration["AuthServer:Authority"] ?? "";

        context.Menu.AddItem(new ApplicationMenuItem(
            "Account.Manage",
            accountStringLocalizer["MyAccount"],
            $"{authServerUrl.EnsureEndsWith('/')}Account/Manage",
            icon: "fa fa-cog",
            order: 1000,
            target: "_blank").RequireAuthenticated());

        return Task.CompletedTask;
    }
}
