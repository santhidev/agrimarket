namespace AgriMarket.Permissions;

public static class AgriMarketPermissions
{
    public const string GroupName = "AgriMarket";

    public static class Products
    {
        public const string Default = GroupName + ".Products";
        public const string Manage = GroupName + ".Products.Manage";
    }
}
