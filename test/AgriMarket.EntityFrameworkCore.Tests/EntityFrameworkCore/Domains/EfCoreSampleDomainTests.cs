using AgriMarket.Samples;
using Xunit;

namespace AgriMarket.EntityFrameworkCore.Domains;

[Collection(AgriMarketTestConsts.CollectionDefinitionName)]
public class EfCoreSampleDomainTests : SampleDomainTests<AgriMarketEntityFrameworkCoreTestModule>
{

}
