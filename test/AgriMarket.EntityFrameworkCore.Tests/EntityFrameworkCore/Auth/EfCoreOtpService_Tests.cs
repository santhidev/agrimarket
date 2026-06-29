using AgriMarket;
using AgriMarket.EntityFrameworkCore;
using Xunit;

namespace AgriMarket.Auth;

/// <summary>Concrete runner for <see cref="OtpService_Tests{T}" /> on SQLite.</summary>
[Collection(AgriMarketTestConsts.CollectionDefinitionName)]
public class EfCoreOtpService_Tests : OtpService_Tests<AgriMarketEntityFrameworkCoreTestModule>
{
}
