using System;
using System.Linq;
using AgriMarket.Products;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace AgriMarket.Products;

/// <summary>
/// Pure domain-logic tests for <see cref="Product"/> aggregate root.
/// No database or DI needed — these verify entity invariants and
/// grade-management methods.
/// </summary>
public class Product_Tests
{
    private static Product CreateSampleProduct() =>
        new(Guid.NewGuid(), "ทุเรียนหมอนทอง", "ผลไม้", "กก.");

    // ── Construction ───────────────────────────────────────────

    [Fact]
    public void Constructor_Should_Set_All_Properties()
    {
        var id = Guid.NewGuid();
        var product = new Product(
            id, "มะม่วง", "ผลไม้", "ลูก",
            requiresColdChain: true, isFragile: false,
            shelfLifeHours: 72, isStackable: false, sortOrder: 5);

        product.Id.ShouldBe(id);
        product.Name.ShouldBe("มะม่วง");
        product.Category.ShouldBe("ผลไม้");
        product.Unit.ShouldBe("ลูก");
        product.RequiresColdChain.ShouldBeTrue();
        product.IsFragile.ShouldBeFalse();
        product.ShelfLifeHours.ShouldBe(72);
        product.IsStackable.ShouldBeFalse();
        product.SortOrder.ShouldBe(5);
        product.IsActive.ShouldBeTrue(); // defaults to active
        product.Grades.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_With_Blank_Name_Should_Throw(string? name)
    {
        Should.Throw<ArgumentException>(() =>
            new Product(Guid.NewGuid(), name!, "ผลไม้", "กก."));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_With_Blank_Category_Should_Throw(string? category)
    {
        Should.Throw<ArgumentException>(() =>
            new Product(Guid.NewGuid(), "ทุเรียน", category!, "กก."));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Constructor_With_Blank_Unit_Should_Throw(string? unit)
    {
        Should.Throw<ArgumentException>(() =>
            new Product(Guid.NewGuid(), "ทุเรียน", "ผลไม้", unit!));
    }

    // ── Setters ────────────────────────────────────────────────

    [Fact]
    public void SetName_Should_Trim_Whitespace()
    {
        var product = CreateSampleProduct();
        product.SetName("  ทุเรียน  ");
        product.Name.ShouldBe("ทุเรียน");
    }

    [Fact]
    public void SetTransportProfile_Should_Update_All_Transport_Fields()
    {
        var product = CreateSampleProduct();
        product.SetTransportProfile(
            requiresColdChain: true,
            isFragile: true,
            shelfLifeHours: 48,
            isStackable: false);

        product.RequiresColdChain.ShouldBeTrue();
        product.IsFragile.ShouldBeTrue();
        product.ShelfLifeHours.ShouldBe(48);
        product.IsStackable.ShouldBeFalse();
    }

    [Fact]
    public void SetActive_Should_Toggle_IsActive()
    {
        var product = CreateSampleProduct();
        product.SetActive(false);
        product.IsActive.ShouldBeFalse();
        product.SetActive(true);
        product.IsActive.ShouldBeTrue();
    }

    // ── AddGrade ───────────────────────────────────────────────

    [Fact]
    public void AddGrade_Should_Add_Grade_To_Collection()
    {
        var product = CreateSampleProduct();
        var gradeId = Guid.NewGuid();

        var grade = product.AddGrade(gradeId, "A", "เกรดพรีเมียม", sortOrder: 1);

        grade.Id.ShouldBe(gradeId);
        grade.ProductId.ShouldBe(product.Id);
        grade.Name.ShouldBe("A");
        grade.Description.ShouldBe("เกรดพรีเมียม");
        grade.SortOrder.ShouldBe(1);
        product.Grades.Count().ShouldBe(1);
    }

    [Fact]
    public void AddGrade_Should_Allow_Multiple_Distinct_Grades()
    {
        var product = CreateSampleProduct();
        product.AddGrade(Guid.NewGuid(), "A");
        product.AddGrade(Guid.NewGuid(), "B");
        product.AddGrade(Guid.NewGuid(), "C");

        product.Grades.Count().ShouldBe(3);
    }

    [Fact]
    public void AddGrade_Should_Throw_On_Duplicate_Name_Case_Insensitive()
    {
        var product = CreateSampleProduct();
        product.AddGrade(Guid.NewGuid(), "A");

        var ex = Should.Throw<BusinessException>(() =>
            product.AddGrade(Guid.NewGuid(), "a"));

        ex.Code.ShouldBe("AgriMarket:DuplicateGradeName");
    }

    [Fact]
    public void AddGrade_Should_Throw_On_Duplicate_Name_Exact()
    {
        var product = CreateSampleProduct();
        product.AddGrade(Guid.NewGuid(), "พิเศษ");

        Should.Throw<BusinessException>(() =>
            product.AddGrade(Guid.NewGuid(), "พิเศษ"));
    }

    // ── UpdateGrade ────────────────────────────────────────────

    [Fact]
    public void UpdateGrade_Should_Update_Name_And_Description()
    {
        var product = CreateSampleProduct();
        var gradeId = Guid.NewGuid();
        product.AddGrade(gradeId, "A", "เก่า", 0);

        var updated = product.UpdateGrade(gradeId, "A+", "ใหม่", 5);

        updated.Name.ShouldBe("A+");
        updated.Description.ShouldBe("ใหม่");
        updated.SortOrder.ShouldBe(5);
    }

    [Fact]
    public void UpdateGrade_Should_Allow_Updating_To_Same_Name()
    {
        var product = CreateSampleProduct();
        var gradeId = Guid.NewGuid();
        product.AddGrade(gradeId, "A", "เก่า");

        // Should not throw even though name "A" already exists for this grade.
        Should.NotThrow(() =>
            product.UpdateGrade(gradeId, "A", "อัปเดต"));
    }

    [Fact]
    public void UpdateGrade_Should_Throw_On_Duplicate_Name_Other_Grade()
    {
        var product = CreateSampleProduct();
        var grade1Id = Guid.NewGuid();
        product.AddGrade(grade1Id, "A");
        product.AddGrade(Guid.NewGuid(), "B");

        Should.Throw<BusinessException>(() =>
            product.UpdateGrade(grade1Id, "B"));
    }

    [Fact]
    public void UpdateGrade_Should_Throw_When_Grade_Not_Found()
    {
        var product = CreateSampleProduct();

        var ex = Should.Throw<BusinessException>(() =>
            product.UpdateGrade(Guid.NewGuid(), "A"));

        ex.Code.ShouldBe("AgriMarket:GradeNotFound");
    }

    // ── RemoveGrade ────────────────────────────────────────────

    [Fact]
    public void RemoveGrade_Should_Remove_Grade_From_Collection()
    {
        var product = CreateSampleProduct();
        var gradeId = Guid.NewGuid();
        product.AddGrade(gradeId, "A");
        product.Grades.Count().ShouldBe(1);

        product.RemoveGrade(gradeId);

        product.Grades.ShouldBeEmpty();
    }

    [Fact]
    public void RemoveGrade_Should_Throw_When_Grade_Not_Found()
    {
        var product = CreateSampleProduct();

        var ex = Should.Throw<BusinessException>(() =>
            product.RemoveGrade(Guid.NewGuid()));

        ex.Code.ShouldBe("AgriMarket:GradeNotFound");
    }

    // ── Fluent API ─────────────────────────────────────────────

    [Fact]
    public void Setters_Should_Return_Self_For_Fluent_Chaining()
    {
        var product = CreateSampleProduct();

        var result = product
            .SetName("มะเขือเทศ")
            .SetCategory("ผัก")
            .SetUnit("ลูก")
            .SetSortOrder(10)
            .SetActive(true);

        result.ShouldBeSameAs(product);
        product.Name.ShouldBe("มะเขือเทศ");
        product.Category.ShouldBe("ผัก");
    }
}
