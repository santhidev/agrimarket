namespace AgriMarket.Users;

/// <summary>
/// KYC verification status. A user must reach <see cref="Approved" /> to submit
/// an Offer (see Issue 05). Defaults to <see cref="None" /> on registration.
/// </summary>
public enum KycStatus
{
    None = 0,
    Pending = 1,
    Approved = 2,
    Rejected = 3
}
