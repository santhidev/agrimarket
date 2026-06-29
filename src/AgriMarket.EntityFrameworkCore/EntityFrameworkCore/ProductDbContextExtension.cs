using AgriMarket.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AgriMarket.EntityFrameworkCore;

public static class ProductDbContextExtension
{
    public static void ConfigureProducts(this ModelBuilder builder)
    {
        builder.Entity<Product>(ConfigureProduct);
        builder.Entity<ProductGrade>(ConfigureProductGrade);
    }

    private static void ConfigureProduct(EntityTypeBuilder<Product> b)
    {
        b.ToTable(AgriMarketConsts.DbTablePrefix + "Products", AgriMarketConsts.DbSchema);

        b.Property(p => p.Name).IsRequired().HasMaxLength(200);
        b.Property(p => p.Category).IsRequired().HasMaxLength(100);
        b.Property(p => p.Unit).IsRequired().HasMaxLength(20);
        b.Property(p => p.RequiresColdChain).HasDefaultValue(false);
        b.Property(p => p.IsFragile).HasDefaultValue(false);
        b.Property(p => p.IsStackable).HasDefaultValue(true);
        b.Property(p => p.IsActive).HasDefaultValue(true);
        b.Property(p => p.SortOrder).HasDefaultValue(0);

        b.HasIndex(p => p.Category);
        b.HasIndex(p => p.Name);

        b.HasMany(p => p.Grades)
            .WithOne()
            .HasForeignKey(g => g.ProductId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired();
    }

    private static void ConfigureProductGrade(EntityTypeBuilder<ProductGrade> b)
    {
        b.ToTable(AgriMarketConsts.DbTablePrefix + "ProductGrades", AgriMarketConsts.DbSchema);

        b.Property(g => g.Name).IsRequired().HasMaxLength(50);
        b.Property(g => g.Description).HasMaxLength(500);
        b.Property(g => g.SortOrder).HasDefaultValue(0);

        b.HasIndex(g => new { g.ProductId, g.Name }).IsUnique();
    }
}
