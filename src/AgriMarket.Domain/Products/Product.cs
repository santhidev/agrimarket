using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace AgriMarket.Products;

/// <summary>
/// Catalog product (e.g. ทุเรียน, มะม่วง, มะเขือเทศ).
/// Aggregate root — owns a collection of <see cref="ProductGrade"/>.
/// Transport-profile flags (<see cref="RequiresColdChain"/>,
/// <see cref="IsFragile"/>, <see cref="IsStackable"/>) and
/// <see cref="ShelfLifeHours"/> guide Phase-2 delivery planning.
/// </summary>
public class Product : FullAuditedAggregateRoot<Guid>
{
    /// <summary>Display name, e.g. "ทุเรียนหมอนทอง".</summary>
    [StringLength(200)]
    public string Name { get; private set; } = default!;

    /// <summary>Category for grouping, e.g. "ผลไม้", "ผัก".</summary>
    [StringLength(100)]
    public string Category { get; private set; } = default!;

    /// <summary>Default unit, e.g. "กก.", "ลูก", "ฟอง".</summary>
    [StringLength(20)]
    public string Unit { get; private set; } = default!;

    /// <summary>Needs cold-chain transport (Phase 2).</summary>
    public bool RequiresColdChain { get; private set; }

    /// <summary>Fragile — handle with care.</summary>
    public bool IsFragile { get; private set; }

    /// <summary>Shelf-life in hours (null = not applicable).</summary>
    public int? ShelfLifeHours { get; private set; }

    /// <summary>Can be stacked during transport.</summary>
    public bool IsStackable { get; private set; }

    /// <summary>Soft-delete / hide from catalogue.</summary>
    public bool IsActive { get; private set; }

    /// <summary>Display ordering. Lower = first.</summary>
    public int SortOrder { get; private set; }

    /// <summary>Grades owned by this product (may be empty = "มาตรฐาน").</summary>
    public ICollection<ProductGrade> Grades { get; private set; } = new List<ProductGrade>();

    protected Product() { }

    public Product(
        Guid id,
        string name,
        string category,
        string unit,
        bool requiresColdChain = false,
        bool isFragile = false,
        int? shelfLifeHours = null,
        bool isStackable = true,
        int sortOrder = 0) : base(id)
    {
        SetName(name);
        SetCategory(category);
        SetUnit(unit);
        RequiresColdChain = requiresColdChain;
        IsFragile = isFragile;
        ShelfLifeHours = shelfLifeHours;
        IsStackable = isStackable;
        SortOrder = sortOrder;
        IsActive = true;
    }

    // ── Property setters with validation ──────────────────────

    public Product SetName(string name)
    {
        Name = string.IsNullOrWhiteSpace(name)
            ? throw new ArgumentException("Product name is required.", nameof(name))
            : name.Trim();
        return this;
    }

    public Product SetCategory(string category)
    {
        Category = string.IsNullOrWhiteSpace(category)
            ? throw new ArgumentException("Category is required.", nameof(category))
            : category.Trim();
        return this;
    }

    public Product SetUnit(string unit)
    {
        Unit = string.IsNullOrWhiteSpace(unit)
            ? throw new ArgumentException("Unit is required.", nameof(unit))
            : unit.Trim();
        return this;
    }

    public Product SetTransportProfile(
        bool requiresColdChain,
        bool isFragile,
        int? shelfLifeHours,
        bool isStackable)
    {
        RequiresColdChain = requiresColdChain;
        IsFragile = isFragile;
        ShelfLifeHours = shelfLifeHours;
        IsStackable = isStackable;
        return this;
    }

    public Product SetSortOrder(int sortOrder)
    {
        SortOrder = sortOrder;
        return this;
    }

    public Product SetActive(bool active)
    {
        IsActive = active;
        return this;
    }

    // ── Grade management (aggregate boundary) ─────────────────

    /// <summary>
    /// Adds a new grade to this product.
    /// Throws if a grade with the same name (case-insensitive) already exists.
    /// </summary>
    public ProductGrade AddGrade(
        Guid id,
        string name,
        string? description = null,
        int sortOrder = 0)
    {
        if (Grades.Any(g => g.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
        {
            throw new BusinessException("AgriMarket:DuplicateGradeName")
                .WithData("Name", name);
        }

        var grade = new ProductGrade(id, Id, name, description, sortOrder);
        Grades.Add(grade);
        return grade;
    }

    /// <summary>Updates an existing grade. Throws if not found.</summary>
    public ProductGrade UpdateGrade(
        Guid gradeId,
        string name,
        string? description = null,
        int sortOrder = 0)
    {
        var grade = Grades.FirstOrDefault(g => g.Id == gradeId)
            ?? throw new BusinessException("AgriMarket:GradeNotFound")
                .WithData("GradeId", gradeId);

        // Check duplicate name excluding the current grade.
        if (Grades.Any(g =>
                g.Id != gradeId &&
                g.Name.Equals(name, StringComparison.OrdinalIgnoreCase)))
        {
            throw new BusinessException("AgriMarket:DuplicateGradeName")
                .WithData("Name", name);
        }

        grade.SetName(name);
        grade.SetDescription(description);
        grade.SetSortOrder(sortOrder);

        return grade;
    }

    /// <summary>Removes a grade. Throws if not found.</summary>
    public void RemoveGrade(Guid gradeId)
    {
        var grade = Grades.FirstOrDefault(g => g.Id == gradeId)
            ?? throw new BusinessException("AgriMarket:GradeNotFound")
                .WithData("GradeId", gradeId);

        Grades.Remove(grade);
    }
}
