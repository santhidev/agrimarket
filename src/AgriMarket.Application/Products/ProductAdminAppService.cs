using System;
using System.Linq;
using System.Threading.Tasks;
using AgriMarket.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;

namespace AgriMarket.Products;

/// <summary>
/// Admin product management — create/update/delete products and manage their grades.
/// Requires the <see cref="AgriMarketPermissions.Products.Manage"/> permission.
/// </summary>
[Authorize(AgriMarketPermissions.Products.Manage)]
public class ProductAdminAppService : AgriMarketAppService, IProductAdminAppService
{
    private readonly IRepository<Product, Guid> _productRepository;
    private readonly IGuidGenerator _guidGenerator;

    public ProductAdminAppService(
        IRepository<Product, Guid> productRepository,
        IGuidGenerator guidGenerator)
    {
        _productRepository = productRepository;
        _guidGenerator = guidGenerator;
    }

    // ── Product CRUD ──────────────────────────────────────────

    public async Task<ListResultDto<ProductDto>> GetListAsync()
    {
        var queryable = await _productRepository.WithDetailsAsync(p => p.Grades);
        var products = await AsyncExecuter.ToListAsync(
            queryable.OrderBy(p => p.SortOrder).ThenBy(p => p.Name));
        var ordered = products
            .Select(ProductAppService.MapToDto)
            .ToList();

        return new ListResultDto<ProductDto>(ordered);
    }

    public async Task<ProductDto> GetAsync(Guid id)
    {
        var product = await GetProductWithGradesAsync(id);
        return ProductAppService.MapToDto(product);
    }

    public async Task<ProductDto> CreateAsync(CreateUpdateProductDto input)
    {
        var product = new Product(
            _guidGenerator.Create(),
            input.Name,
            input.Category,
            input.Unit,
            input.RequiresColdChain,
            input.IsFragile,
            input.ShelfLifeHours,
            input.IsStackable,
            input.SortOrder);

        // Seed initial grades if provided.
        if (input.Grades is { Count: > 0 })
        {
            foreach (var gradeDto in input.Grades)
            {
                product.AddGrade(
                    _guidGenerator.Create(),
                    gradeDto.Name,
                    gradeDto.Description,
                    gradeDto.SortOrder);
            }
        }

        await _productRepository.InsertAsync(product, autoSave: true);
        return ProductAppService.MapToDto(product);
    }

    public async Task<ProductDto> UpdateAsync(Guid id, CreateUpdateProductDto input)
    {
        var product = await GetProductWithGradesAsync(id);

        product
            .SetName(input.Name)
            .SetCategory(input.Category)
            .SetUnit(input.Unit)
            .SetTransportProfile(
                input.RequiresColdChain,
                input.IsFragile,
                input.ShelfLifeHours,
                input.IsStackable)
            .SetSortOrder(input.SortOrder);

        await _productRepository.UpdateAsync(product, autoSave: true);
        return ProductAppService.MapToDto(product);
    }

    public async Task DeleteAsync(Guid id)
    {
        // Soft-delete: deactivate rather than hard-delete to preserve referential integrity.
        var product = await GetProductWithGradesAsync(id);
        product.SetActive(false);
        await _productRepository.UpdateAsync(product, autoSave: true);
    }

    // ── Grade management ──────────────────────────────────────

    public async Task<ProductGradeDto> CreateGradeAsync(Guid id, CreateProductGradeDto input)
    {
        var product = await GetProductWithGradesAsync(id);
        var grade = product.AddGrade(
            _guidGenerator.Create(),
            input.Name,
            input.Description,
            input.SortOrder);

        await _productRepository.UpdateAsync(product, autoSave: true);
        return ProductAppService.MapGradeToDto(grade);
    }

    public async Task<ProductGradeDto> UpdateGradeAsync(Guid id, Guid gradeId, UpdateProductGradeDto input)
    {
        var product = await GetProductWithGradesAsync(id);
        var grade = product.UpdateGrade(
            gradeId,
            input.Name,
            input.Description,
            input.SortOrder);

        await _productRepository.UpdateAsync(product, autoSave: true);
        return ProductAppService.MapGradeToDto(grade);
    }

    public async Task DeleteGradeAsync(Guid id, Guid gradeId)
    {
        var product = await GetProductWithGradesAsync(id);
        product.RemoveGrade(gradeId);
        await _productRepository.UpdateAsync(product, autoSave: true);
    }

    // ── Helpers ───────────────────────────────────────────────

    private async Task<Product> GetProductWithGradesAsync(Guid id)
    {
        var queryable = await _productRepository.WithDetailsAsync(p => p.Grades);
        var product = await AsyncExecuter.FirstOrDefaultAsync(queryable.Where(p => p.Id == id));
        if (product == null)
        {
            throw new EntityNotFoundException(typeof(Product), id);
        }
        return product;
    }
}
