using System;
using Volo.Abp.Data;
using Volo.Abp.Identity;

namespace AgriMarket.Users;

/// <summary>
/// AgriMarket extensions over ABP's <see cref="IdentityUser" />.
///
/// AgriMarket extends the identity user with the custom columns from the
/// PRD <c>users</c> schema (<c>fcm_token</c>, <c>tier</c>, <c>kyc_status</c>,
/// scores, role flags, <c>hub_id</c>). On ABP 10 these columns live on the
/// <c>AbpUsers</c> table as extra-properties (see
/// <c>AgriMarketModuleExtensionConfigurator</c> in Domain.Shared), so there is
/// no separate <c>AppUser</c> entity type — the columns are read and written
/// through <see cref="IdentityUser.ExtraProperties" /> via the helpers below.
///
/// Phone number is the primary identifier (phone-as-username convention from
/// <c>AgriMarketDataSeeder</c>): stored in <see cref="IdentityUser.UserName" />
/// and <see cref="IdentityUser.PhoneNumber" />.
/// </summary>
public static class AppUser
{
    public const string FcmTokenProperty = "FcmToken";
    public const string TierProperty = "Tier";
    public const string KycStatusProperty = "KycStatus";
    public const string BuyerScoreProperty = "BuyerScore";
    public const string SellerScoreProperty = "SellerScore";
    public const string IsAdminProperty = "IsAdmin";
    public const string IsRiderProperty = "IsRider";
    public const string IsHubStaffProperty = "IsHubStaff";
    public const string HubIdProperty = "HubId";

    public static string? GetFcmToken(this IdentityUser user)
        => user.GetProperty<string?>(FcmTokenProperty);

    public static void SetFcmToken(this IdentityUser user, string? token)
        => user.SetProperty(FcmTokenProperty, token);

    public static CreditTier GetTier(this IdentityUser user)
        => user.GetProperty<CreditTier>(TierProperty);

    public static void SetTier(this IdentityUser user, CreditTier tier)
        => user.SetProperty(TierProperty, tier);

    public static KycStatus GetKycStatus(this IdentityUser user)
        => user.GetProperty<KycStatus>(KycStatusProperty);

    public static void SetKycStatus(this IdentityUser user, KycStatus status)
        => user.SetProperty(KycStatusProperty, status);

    public static int GetBuyerScore(this IdentityUser user)
        => user.GetProperty<int>(BuyerScoreProperty);

    public static void SetBuyerScore(this IdentityUser user, int score)
        => user.SetProperty(BuyerScoreProperty, score);

    public static int GetSellerScore(this IdentityUser user)
        => user.GetProperty<int>(SellerScoreProperty);

    public static void SetSellerScore(this IdentityUser user, int score)
        => user.SetProperty(SellerScoreProperty, score);

    public static bool GetIsAdmin(this IdentityUser user)
        => user.GetProperty<bool>(IsAdminProperty);

    public static void SetIsAdmin(this IdentityUser user, bool value)
        => user.SetProperty(IsAdminProperty, value);

    public static bool GetIsRider(this IdentityUser user)
        => user.GetProperty<bool>(IsRiderProperty);

    public static void SetIsRider(this IdentityUser user, bool value)
        => user.SetProperty(IsRiderProperty, value);

    public static bool GetIsHubStaff(this IdentityUser user)
        => user.GetProperty<bool>(IsHubStaffProperty);

    public static void SetIsHubStaff(this IdentityUser user, bool value)
        => user.SetProperty(IsHubStaffProperty, value);

    public static Guid? GetHubId(this IdentityUser user)
        => user.GetProperty<Guid?>(HubIdProperty);

    public static void SetHubId(this IdentityUser user, Guid? hubId)
        => user.SetProperty(HubIdProperty, hubId);
}
