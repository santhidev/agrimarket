using System;
using System.ComponentModel.DataAnnotations;

namespace AgriMarket.Products;

/// <summary>DTO for a product grade.</summary>
public class ProductGradeDto
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}
