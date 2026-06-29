using System;
using Microsoft.EntityFrameworkCore;
using Volo.Abp.Identity;
using Volo.Abp.ObjectExtending;
using Volo.Abp.Threading;

namespace AgriMarket.EntityFrameworkCore;

public static class AgriMarketEfCoreEntityExtensionMappings
{
    private static readonly OneTimeRunner OneTimeRunner = new OneTimeRunner();

    public static void Configure()
    {
        AgriMarketGlobalFeatureConfigurator.Configure();
        AgriMarketModuleExtensionConfigurator.Configure();

        OneTimeRunner.Run(() =>
        {
            // Map AgriMarket's extra properties on IdentityUser to dedicated
            // columns on the AbpUsers table (instead of the default JSON
            // ExtraProperties bag), so they are indexable/queryable. The
            // properties themselves are declared in
            // AgriMarketModuleExtensionConfigurator (Domain.Shared).
            ObjectExtensionManager.Instance
                .MapEfCoreProperty<IdentityUser, string>(
                    "FcmToken",
                    (_, pb) => pb.HasMaxLength(512)
                )
                .MapEfCoreProperty<IdentityUser, int>("Tier")
                .MapEfCoreProperty<IdentityUser, int>("KycStatus")
                .MapEfCoreProperty<IdentityUser, int>("BuyerScore")
                .MapEfCoreProperty<IdentityUser, int>("SellerScore")
                .MapEfCoreProperty<IdentityUser, bool>("IsAdmin")
                .MapEfCoreProperty<IdentityUser, bool>("IsRider")
                .MapEfCoreProperty<IdentityUser, bool>("IsHubStaff")
                .MapEfCoreProperty<IdentityUser, Guid?>("HubId");
        });
    }
}
