using System.ComponentModel.DataAnnotations;

namespace AgriMarket.Products;

/// <summary>Input DTO for creating a product grade.</summary>
public class CreateProductGradeDto
{
    [Required, StringLength(50)]
    public string Name { get; set; } = default!;

    [StringLength(500)]
    public string? Description { get; set; }

    public int SortOrder { get; set; }
}
