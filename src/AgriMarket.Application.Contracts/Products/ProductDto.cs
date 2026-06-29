using System;
using System.Collections.Generic;

namespace AgriMarket.Products;

/// <summary>DTO for a product, including its grades.</summary>
public class ProductDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public string Category { get; set; } = default!;
    public string Unit { get; set; } = default!;
    public bool RequiresColdChain { get; set; }
    public bool IsFragile { get; set; }
    public int? ShelfLifeHours { get; set; }
    public bool IsStackable { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
    public List<ProductGradeDto> Grades { get; set; } = new();

    /// <summary>
    /// True when no grades are defined — the product uses "มาตรฐาน" (Standard).
    /// </summary>
    public bool HasStandardGrade => Grades.Count == 0;
}
