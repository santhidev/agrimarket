using Xunit;

namespace AgriMarket.EntityFrameworkCore;

[CollectionDefinition(AgriMarketTestConsts.CollectionDefinitionName)]
public class AgriMarketEntityFrameworkCoreCollection : ICollectionFixture<AgriMarketEntityFrameworkCoreFixture>
{

}
