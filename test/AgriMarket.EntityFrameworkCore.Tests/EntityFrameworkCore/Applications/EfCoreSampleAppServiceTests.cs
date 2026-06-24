using AgriMarket.Samples;
using Xunit;

namespace AgriMarket.EntityFrameworkCore.Applications;

[Collection(AgriMarketTestConsts.CollectionDefinitionName)]
public class EfCoreSampleAppServiceTests : SampleAppServiceTests<AgriMarketEntityFrameworkCoreTestModule>
{

}
