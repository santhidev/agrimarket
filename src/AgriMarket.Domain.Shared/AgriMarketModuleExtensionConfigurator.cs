using System;
using System.ComponentModel.DataAnnotations;
using AgriMarket.Users;
using Volo.Abp.Identity;
using Volo.Abp.ObjectExtending;
using Volo.Abp.Threading;

namespace AgriMarket;

public static class AgriMarketModuleExtensionConfigurator
{
    private static readonly OneTimeRunner OneTimeRunner = new OneTimeRunner();

    public static void Configure()
    {
        OneTimeRunner.Run(() =>
        {
            ConfigureExistingProperties();
            ConfigureExtraProperties();
        });
    }

    private static void ConfigureExistingProperties()
    {
        /* You can change max lengths for properties of the
         * entities defined in the modules used by your application.
         *
         * Notice: It is not suggested to change property lengths
         * unless you really need it. Go with the standard values wherever possible.
         *
         * If you are using EF Core, you will need to run the add-migration command after your changes.
         */
    }

    private static void ConfigureExtraProperties()
    {
        // AgriMarket extends ABP's IdentityUser with the custom columns from the
        // PRD `users` schema (fcm_token, tier, kyc_status, scores, role flags,
        // hub_id). ABP's ObjectExtensionManager puts them as columns on the
        // existing AbpUsers table (no new table, no discriminator). Property
        // names are mirrored as constants in Domain/Users/AppUser.cs and must
        // stay in sync with the literals here.
        ObjectExtensionManager.Instance.Modules()
            .ConfigureIdentity(identity =>
            {
                identity.ConfigureUser(user =>
                {
                    user.AddOrUpdateProperty<string>(
                        "FcmToken",
                        property => property.Attributes.Add(new StringLengthAttribute(512))
                    );

                    user.AddOrUpdateProperty<CreditTier>("Tier");
                    user.AddOrUpdateProperty<KycStatus>("KycStatus");
                    user.AddOrUpdateProperty<int>("BuyerScore");
                    user.AddOrUpdateProperty<int>("SellerScore");
                    user.AddOrUpdateProperty<bool>("IsAdmin");
                    user.AddOrUpdateProperty<bool>("IsRider");
                    user.AddOrUpdateProperty<bool>("IsHubStaff");
                    user.AddOrUpdateProperty<Guid?>("HubId");
                });
            });
    }
}

