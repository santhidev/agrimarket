using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AgriMarket.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace AgriMarket.Products;

/// <summary>
/// Public product browse service.
/// Anyone (anonymous or authenticated) can browse active products.
/// </summary>
[Authorize(AgriMarketPermissions.Products.Default)]
public class ProductAppService : AgriMarketAppService, IProductAppService
{
    private readonly IRepository<Product, Guid> _productRepository;

    public ProductAppService(IRepository<Product, Guid> productRepository)
    {
        _productRepository = productRepository;
    }

    public async Task<ListResultDto<ProductDto>> GetListAsync()
    {
        var queryable = await _productRepository.WithDetailsAsync(p => p.Grades);
        var products = await AsyncExecuter.ToListAsync(
            queryable.Where(p => p.IsActive)
                .OrderBy(p => p.SortOrder)
                .ThenBy(p => p.Name));
        var ordered = products
            .Select(MapToDto)
            .ToList();

        return new ListResultDto<ProductDto>(ordered);
    }

    public async Task<ProductDto> GetAsync(Guid id)
    {
        var product = await GetProductWithGradesAsync(id);
        return MapToDto(product);
    }

    public async Task<ListResultDto<ProductGradeDto>> GetGradesAsync(Guid id)
    {
        var product = await GetProductWithGradesAsync(id);
        var grades = product.Grades
            .OrderBy(g => g.SortOrder)
            .ThenBy(g => g.Name)
            .Select(MapGradeToDto)
            .ToList();

        return new ListResultDto<ProductGradeDto>(grades);
    }

    // ── Mapping helpers ───────────────────────────────────────

    internal static ProductDto MapToDto(Product product)
    {
        return new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Category = product.Category,
            Unit = product.Unit,
            RequiresColdChain = product.RequiresColdChain,
            IsFragile = product.IsFragile,
            ShelfLifeHours = product.ShelfLifeHours,
            IsStackable = product.IsStackable,
            IsActive = product.IsActive,
            SortOrder = product.SortOrder,
            Grades = product.Grades
                .OrderBy(g => g.SortOrder)
                .ThenBy(g => g.Name)
                .Select(MapGradeToDto)
                .ToList()
        };
    }

    internal static ProductGradeDto MapGradeToDto(ProductGrade grade)
    {
        return new ProductGradeDto
        {
            Id = grade.Id,
            ProductId = grade.ProductId,
            Name = grade.Name,
            Description = grade.Description,
            SortOrder = grade.SortOrder
        };
    }

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
