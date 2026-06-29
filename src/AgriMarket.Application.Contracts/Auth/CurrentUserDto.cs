using System;
using AgriMarket.Users;

namespace AgriMarket.Auth;

public class CurrentUserDto
{
    public Guid Id { get; set; }

    public string UserName { get; set; } = default!;

    public string PhoneNumber { get; set; } = default!;

    public CreditTier Tier { get; set; }

    public KycStatus KycStatus { get; set; }

    public bool IsAdmin { get; set; }
}
