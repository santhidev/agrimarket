using System.Threading.Tasks;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Guids;
using Volo.Abp.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AgriMarket.Data;

public class AgriMarketDataSeeder : IDataSeedContributor, ITransientDependency
{
    private readonly IdentityUserManager _userManager;
    private readonly IIdentityUserRepository _userRepository;
    private readonly IGuidGenerator _guidGenerator;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AgriMarketDataSeeder> _logger;

    public AgriMarketDataSeeder(
        IdentityUserManager userManager,
        IIdentityUserRepository userRepository,
        IGuidGenerator guidGenerator,
        IConfiguration configuration,
        ILogger<AgriMarketDataSeeder> logger)
    {
        _userManager = userManager;
        _userRepository = userRepository;
        _guidGenerator = guidGenerator;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SeedAsync(DataSeedContext context)
    {
        var adminPhone = _configuration["ADMIN_PHONE"];

        if (string.IsNullOrEmpty(adminPhone))
        {
            _logger.LogWarning("ADMIN_PHONE env not set. Skipping admin seed.");
            return;
        }

        var existing = await _userRepository.FindByNormalizedUserNameAsync(adminPhone.ToUpperInvariant());
        if (existing != null)
        {
            _logger.LogInformation("Admin user already exists for phone {Phone}", adminPhone);
            return;
        }

        var adminUser = new IdentityUser(
            _guidGenerator.Create(),
            adminPhone,
            adminPhone + "@agrimarket.local"
        );

        adminUser.SetIsActive(true);
        // Set is_admin flag (custom property or role)

        var result = await _userManager.CreateAsync(adminUser, "Admin@123456");
        if (!result.Succeeded)
        {
            _logger.LogError("Failed to create admin user: {Errors}", string.Join(", ", result.Errors));
            return;
        }

        // Assign admin role
        await _userManager.AddToRoleAsync(adminUser, "admin");

        _logger.LogInformation("Admin user created successfully for phone {Phone}", adminPhone);
    }
}
