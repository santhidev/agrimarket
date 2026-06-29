using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace AgriMarket.Products;

/// <summary>
/// Input DTO for creating or updating a product.
/// The optional <see cref="Grades"/> array seeds initial grades on create.
/// </summary>
public class CreateUpdateProductDto
{
    [Required, StringLength(200)]
    public string Name { get; set; } = default!;

    [Required, StringLength(100)]
    public string Category { get; set; } = default!;

    [Required, StringLength(20)]
    public string Unit { get; set; } = default!;

    public bool RequiresColdChain { get; set; }
    public bool IsFragile { get; set; }
    public int? ShelfLifeHours { get; set; }
    public bool IsStackable { get; set; } = true;
    public int SortOrder { get; set; }

    /// <summary>Initial grades to create with the product (create only).</summary>
    public List<CreateProductGradeDto>? Grades { get; set; }
}
