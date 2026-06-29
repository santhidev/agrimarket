namespace AgriMarket.Users;

/// <summary>
/// Credit tier of a user. Managed by admin (Phase 2 credit engine).
/// MVP default: <see cref="None" />.
/// </summary>
public enum CreditTier
{
    None = 0,
    Bronze = 1,
    Silver = 2,
    Gold = 3
}
