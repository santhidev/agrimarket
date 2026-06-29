using System.Threading.Tasks;
using AgriMarket.Users;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Guids;
using Volo.Abp.Identity;

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

        // Store the admin flag as an extra property (see AppUser extensions).
        // This resolves the TODO that was previously left in the seeder.
        adminUser.SetIsAdmin(true);

        var result = await _userManager.CreateAsync(adminUser, "Admin@123456");
        if (!result.Succeeded)
        {
            _logger.LogError("Failed to create admin user: {Errors}", string.Join(", ", result.Errors));
            return;
        }

        // Confirm the phone number via the manager (setters are protected).
        // The phone is already in UserName (phone-as-username convention).
        await _userManager.SetPhoneNumberAsync(adminUser, adminPhone);

        // Assign admin role
        await _userManager.AddToRoleAsync(adminUser, "admin");

        _logger.LogInformation("Admin user created successfully for phone {Phone}", adminPhone);
    }
}
