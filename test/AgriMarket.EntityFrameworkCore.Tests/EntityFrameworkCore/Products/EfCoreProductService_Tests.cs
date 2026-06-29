using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AgriMarket.EntityFrameworkCore;
using AgriMarket.Products;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Volo.Abp;
using Volo.Abp.Domain.Repositories;
using Xunit;

namespace AgriMarket.Products;

/// <summary>
/// Integration tests for ProductAdminAppService and ProductAppService
/// against the SQLite in-memory test host.
/// </summary>
[Collection(AgriMarketTestConsts.CollectionDefinitionName)]
public class EfCoreProductService_Tests : AgriMarketEntityFrameworkCoreTestBase
{
    private readonly IProductAdminAppService _adminService;
    private readonly IProductAppService _browseService;
    private readonly IRepository<Product, Guid> _productRepository;

    public EfCoreProductService_Tests()
    {
        _adminService = GetRequiredService<IProductAdminAppService>();
        _browseService = GetRequiredService<IProductAppService>();
        _productRepository = GetRequiredService<IRepository<Product, Guid>>();
    }

    // ── Create ─────────────────────────────────────────────────

    [Fact]
    public async Task Create_Product_Should_Persist_And_Return_Dto()
    {
        var dto = new CreateUpdateProductDto
        {
            Name = "ทุเรียนหมอนทอง",
            Category = "ผลไม้",
            Unit = "กก.",
            RequiresColdChain = true,
            ShelfLifeHours = 48
        };

        var result = await _adminService.CreateAsync(dto);

        result.Id.ShouldNotBe(Guid.Empty);
        result.Name.ShouldBe("ทุเรียนหมอนทอง");
        result.Category.ShouldBe("ผลไม้");
        result.Unit.ShouldBe("กก.");
        result.RequiresColdChain.ShouldBeTrue();
        result.ShelfLifeHours.ShouldBe(48);
        result.IsActive.ShouldBeTrue();
        result.HasStandardGrade.ShouldBeTrue(); // no grades = standard

        // Verify persisted in DB.
        await WithUnitOfWorkAsync(async () =>
        {
            var product = await _productRepository.GetAsync(result.Id);
            product.Name.ShouldBe("ทุเรียนหมอนทอง");
        });
    }

    [Fact]
    public async Task Create_Product_With_Grades_Should_Persist_Grades()
    {
        var dto = new CreateUpdateProductDto
        {
            Name = "มะม่วงน้ำดอกไม้",
            Category = "ผลไม้",
            Unit = "ลูก",
            Grades = new()
            {
                new() { Name = "A", Description = "เกรดพรีเมียม", SortOrder = 1 },
                new() { Name = "B", Description = "เกรดดี", SortOrder = 2 },
                new() { Name = "C", SortOrder = 3 }
            }
        };

        var result = await _adminService.CreateAsync(dto);

        result.Grades.Count.ShouldBe(3);
        result.Grades[0].Name.ShouldBe("A");
        result.Grades[0].Description.ShouldBe("เกรดพรีเมียม");
        result.Grades[1].Name.ShouldBe("B");
        result.HasStandardGrade.ShouldBeFalse();
    }

    // ── Read ───────────────────────────────────────────────────

    [Fact]
    public async Task Admin_GetList_Should_Return_All_Products()
    {
        await CreateProductAsync("ทดสอบ A", active: true);
        await CreateProductAsync("ทดสอบ B", active: false);

        var result = await _adminService.GetListAsync();

        result.Items.Count.ShouldBeGreaterThanOrEqualTo(2);
        result.Items.ShouldContain(p => p.Name == "ทดสอบ A");
        result.Items.ShouldContain(p => p.Name == "ทดสอบ B");
    }

    [Fact]
    public async Task Browse_GetList_Should_Return_Only_Active_Products()
    {
        await CreateProductAsync("ใช้งาน", active: true);
        await CreateProductAsync("ปิดใช้งาน", active: false);

        var result = await _browseService.GetListAsync();

        result.Items.ShouldContain(p => p.Name == "ใช้งาน");
        result.Items.ShouldNotContain(p => p.Name == "ปิดใช้งาน");
    }

    [Fact]
    public async Task GetAsync_Should_Return_Product_By_Id()
    {
        var created = await CreateProductAsync("มะเขือเทศ");

        var result = await _browseService.GetAsync(created.Id);

        result.Name.ShouldBe("มะเขือเทศ");
    }

    [Fact]
    public async Task GetGradesAsync_Should_Return_Grades_Ordered()
    {
        var created = await CreateProductAsync("ส้ม", grades: new()
        {
            new() { Name = "C", SortOrder = 3 },
            new() { Name = "A", SortOrder = 1 },
            new() { Name = "B", SortOrder = 2 }
        });

        var result = await _browseService.GetGradesAsync(created.Id);

        result.Items.Count.ShouldBe(3);
        result.Items[0].Name.ShouldBe("A");
        result.Items[1].Name.ShouldBe("B");
        result.Items[2].Name.ShouldBe("C");
    }

    // ── Update ─────────────────────────────────────────────────

    [Fact]
    public async Task Update_Product_Should_Change_Name_And_Properties()
    {
        var created = await CreateProductAsync("ชื่อเก่า", category: "หมวดเก่า");

        var updated = await _adminService.UpdateAsync(created.Id, new CreateUpdateProductDto
        {
            Name = "ชื่อใหม่",
            Category = "หมวดใหม่",
            Unit = "ลูก",
            RequiresColdChain = true,
            IsStackable = false
        });

        updated.Name.ShouldBe("ชื่อใหม่");
        updated.Category.ShouldBe("หมวดใหม่");
        updated.RequiresColdChain.ShouldBeTrue();
        updated.IsStackable.ShouldBeFalse();
    }

    // ── Delete (soft delete) ───────────────────────────────────

    [Fact]
    public async Task Delete_Product_Should_Deactivate_Not_Remove()
    {
        var created = await CreateProductAsync("ลบทดสอบ", active: true);

        await _adminService.DeleteAsync(created.Id);

        // Admin should still see it but IsActive = false.
        var result = await _adminService.GetAsync(created.Id);
        result.IsActive.ShouldBeFalse();

        // Browse should not return it.
        var browse = await _browseService.GetListAsync();
        browse.Items.ShouldNotContain(p => p.Id == created.Id);
    }

    // ── Grade management through admin service ─────────────────

    [Fact]
    public async Task CreateGrade_Should_Add_Grade_To_Product()
    {
        var created = await CreateProductAsync("แตงโม");

        var grade = await _adminService.CreateGradeAsync(created.Id,
            new CreateProductGradeDto { Name = "พิเศษ", Description = "หวานมาก" });

        grade.Name.ShouldBe("พิเศษ");
        grade.Description.ShouldBe("หวานมาก");

        // Verify via GetAsync.
        var product = await _adminService.GetAsync(created.Id);
        product.Grades.Count.ShouldBe(1);
        product.Grades.First().Name.ShouldBe("พิเศษ");
    }

    [Fact]
    public async Task UpdateGrade_Should_Change_Grade_Properties()
    {
        var created = await CreateProductAsync("กล้วย", grades: new()
        {
            new() { Name = "A", Description = "เก่า" }
        });

        var gradeId = created.Grades.First().Id;
        var updated = await _adminService.UpdateGradeAsync(created.Id, gradeId,
            new UpdateProductGradeDto { Name = "A+", Description = "ใหม่", SortOrder = 5 });

        updated.Name.ShouldBe("A+");
        updated.Description.ShouldBe("ใหม่");
        updated.SortOrder.ShouldBe(5);
    }

    [Fact]
    public async Task DeleteGrade_Should_Remove_Grade_From_Product()
    {
        var created = await CreateProductAsync("สับปะรด", grades: new()
        {
            new() { Name = "A" },
            new() { Name = "B" }
        });

        var gradeId = created.Grades.First(g => g.Name == "A").Id;
        await _adminService.DeleteGradeAsync(created.Id, gradeId);

        var product = await _adminService.GetAsync(created.Id);
        product.Grades.Count.ShouldBe(1);
        product.Grades.First().Name.ShouldBe("B");
    }

    [Fact]
    public async Task CreateGrade_With_Duplicate_Name_Should_Throw()
    {
        var created = await CreateProductAsync("ฝรั่ง", grades: new()
        {
            new() { Name = "A" }
        });

        await Should.ThrowAsync<BusinessException>(() =>
            _adminService.CreateGradeAsync(created.Id,
                new CreateProductGradeDto { Name = "a" })); // case-insensitive
    }

    // ── Ordering ───────────────────────────────────────────────

    [Fact]
    public async Task GetList_Should_Order_By_SortOrder_Then_Name()
    {
        await CreateProductAsync("มะละกอ", sortOrder: 10);
        await CreateProductAsync("กล้วย", sortOrder: 1);
        await CreateProductAsync("ส้มโอ", sortOrder: 1);

        var result = await _browseService.GetListAsync();

        var names = result.Items
            .Where(p => p.Name is "มะละกอ" or "กล้วย" or "ส้มโอ")
            .Select(p => p.Name)
            .ToList();

        // SortOrder 1 items first, alphabetically: กล้วย before ส้มโอ
        names[0].ShouldBe("กล้วย");
        names[1].ShouldBe("ส้มโอ");
        names[2].ShouldBe("มะละกอ");
    }

    // ── Helper ─────────────────────────────────────────────────

    private async Task<ProductDto> CreateProductAsync(
        string name,
        string category = "ผลไม้",
        string unit = "กก.",
        bool active = true,
        int sortOrder = 0,
        List<CreateProductGradeDto>? grades = null)
    {
        var dto = new CreateUpdateProductDto
        {
            Name = name,
            Category = category,
            Unit = unit,
            SortOrder = sortOrder,
            Grades = grades
        };

        var result = await _adminService.CreateAsync(dto);

        if (!active)
        {
            await _adminService.DeleteAsync(result.Id); // soft delete
            result = await _adminService.GetAsync(result.Id);
        }

        return result;
    }
}
