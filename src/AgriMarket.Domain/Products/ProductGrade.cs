using System;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Domain.Entities.Auditing;

namespace AgriMarket.Products;

/// <summary>
/// Grade of a product — product-specific (ทุเรียน A/B/C, มะม่วง พิเศษ/A/B).
/// A child entity of the <see cref="Product"/> aggregate root.
/// Products without grades are treated as "มาตรฐาน" (Standard).
/// </summary>
public class ProductGrade : FullAuditedEntity<Guid>
{
    /// <summary>FK to <see cref="Product"/>.</summary>
    public Guid ProductId { get; private set; }

    /// <summary>Grade name, e.g. "A", "B", "พิเศษ".</summary>
    [StringLength(50)]
    public string Name { get; private set; } = default!;

    /// <summary>Optional human-readable description.</summary>
    [StringLength(500)]
    public string? Description { get; private set; }

    /// <summary>Display ordering. Lower = first.</summary>
    public int SortOrder { get; private set; }

    protected ProductGrade() { }

    internal ProductGrade(
        Guid id,
        Guid productId,
        string name,
        string? description,
        int sortOrder)
    {
        Id = id;
        ProductId = productId;
        SetName(name);
        Description = description;
        SortOrder = sortOrder;
    }

    internal ProductGrade SetName(string name)
    {
        Name = string.IsNullOrWhiteSpace(name)
            ? throw new ArgumentException("Grade name is required.", nameof(name))
            : name.Trim();
        return this;
    }

    internal ProductGrade SetDescription(string? description)
    {
        Description = description;
        return this;
    }

    internal ProductGrade SetSortOrder(int sortOrder)
    {
        SortOrder = sortOrder;
        return this;
    }
}
