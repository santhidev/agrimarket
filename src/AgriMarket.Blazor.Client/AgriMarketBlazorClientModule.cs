using System;
using System.Net.Http;
using AgriMarket.Blazor.Client.Auth;
using AgriMarket.Blazor.Client.Menus;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp.AspNetCore.Components.Web.Theming.MudBlazor.Routing;
using Volo.Abp.AspNetCore.Components.WebAssembly.MudBlazorBasicTheme;
using Volo.Abp.Autofac.WebAssembly;
using Volo.Abp.Mapperly;
using Volo.Abp.Identity.Blazor.MudBlazor.WebAssembly;
using Volo.Abp.Modularity;
using Volo.Abp.SettingManagement.Blazor.MudBlazor.WebAssembly;
using Volo.Abp.TenantManagement.Blazor.MudBlazor.WebAssembly;
using Volo.Abp.UI.Navigation;

namespace AgriMarket.Blazor.Client;

[DependsOn(
    typeof(AbpAutofacWebAssemblyModule),
    typeof(AgriMarketHttpApiClientModule),
    typeof(AbpAspNetCoreComponentsWebAssemblyMudBlazorBasicThemeModule),
    typeof(AbpIdentityBlazorMudBlazorWebAssemblyModule),
    typeof(AbpTenantManagementBlazorMudBlazorWebAssemblyModule),
    typeof(AbpSettingManagementBlazorMudBlazorWebAssemblyModule)
)]
public class AgriMarketBlazorClientModule : AbpModule
{
    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        var environment = context.Services.GetSingletonInstance<IWebAssemblyHostEnvironment>();

        ConfigureAuthentication(context.Services);
        ConfigureHttpClient(context.Services, environment);
        ConfigureRouter(context);
        ConfigureMenu(context);

        context.Services.AddMapperlyObjectMapper<AgriMarketBlazorClientModule>();
    }

    private void ConfigureRouter(ServiceConfigurationContext context)
    {
        Configure<AbpRouterOptions>(options =>
        {
            options.AppAssembly = typeof(AgriMarketBlazorClientModule).Assembly;
        });
    }

    private void ConfigureMenu(ServiceConfigurationContext context)
    {
        Configure<AbpNavigationOptions>(options =>
        {
            options.MenuContributors.Add(new AgriMarketMenuContributor(context.Services.GetConfiguration()));
        });
    }

    /// <summary>
    /// Token-based auth: the phone-OTP flow issues a plain JWT (no OIDC
    /// redirect). A custom <see cref="AuthenticationStateProvider" /> reads
    /// the token from localStorage and an HTTP handler attaches it to API calls.
    /// </summary>
    private static void ConfigureAuthentication(IServiceCollection services)
    {
        services.AddAuthorizationCore();
        services.AddScoped<ITokenStorage, LocalStorageTokenStorage>();
        services.AddScoped<AgriMarketAuthenticationStateProvider>();
        services.AddScoped<AuthenticationStateProvider>(sp =>
            sp.GetRequiredService<AgriMarketAuthenticationStateProvider>());
    }

    private static void ConfigureHttpClient(IServiceCollection services, IWebAssemblyHostEnvironment environment)
    {
        // ABP dynamic client proxies resolve the API base URL from
        // RemoteServices:Default:BaseUrl. Register the auth handler so every
        // proxied call carries the JWT.
        services.AddTransient<AuthenticatingHttpMessageHandler>();
        services.AddHttpClient("AgriMarket.Api")
            .AddHttpMessageHandler<AuthenticatingHttpMessageHandler>();

        // Generic HttpClient for ad-hoc calls (base = the WASM host origin).
        services.AddTransient(sp =>
        {
            var handler = sp.GetRequiredService<AuthenticatingHttpMessageHandler>();
            handler.InnerHandler = new HttpClientHandler();
            return new HttpClient(handler)
            {
                BaseAddress = new Uri(environment.BaseAddress)
            };
        });
    }
}

