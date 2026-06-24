using System.Threading.Tasks;

namespace AgriMarket.Data;

public interface IAgriMarketDbSchemaMigrator
{
    Task MigrateAsync();
}
