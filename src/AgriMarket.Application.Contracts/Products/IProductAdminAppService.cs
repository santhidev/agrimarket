using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace AgriMarket.Products;

/// <summary>
/// Admin product management — requires admin permission.
/// Auto-exposed at <c>/api/app/product-admin/*</c> by ABP convention routing.
/// </summary>
public interface IProductAdminAppService : IApplicationService
{
    // ── Product CRUD ──────────────────────────────────────────

    /// <summary>List all products (including inactive) for admin management.</summary>
    Task<ListResultDto<ProductDto>> GetListAsync();

    /// <summary>Get a product by ID for editing.</summary>
    Task<ProductDto> GetAsync(Guid id);

    /// <summary>Create a new product with optional initial grades.</summary>
    Task<ProductDto> CreateAsync(CreateUpdateProductDto input);

    /// <summary>Update a product's properties.</summary>
    Task<ProductDto> UpdateAsync(Guid id, CreateUpdateProductDto input);

    /// <summary>Delete (deactivate) a product.</summary>
    Task DeleteAsync(Guid id);

    // ── Grade management ──────────────────────────────────────

    /// <summary>Add a grade to a product.</summary>
    Task<ProductGradeDto> CreateGradeAsync(Guid id, CreateProductGradeDto input);

    /// <summary>Update a grade on a product.</summary>
    Task<ProductGradeDto> UpdateGradeAsync(Guid id, Guid gradeId, UpdateProductGradeDto input);

    /// <summary>Remove a grade from a product.</summary>
    Task DeleteGradeAsync(Guid id, Guid gradeId);
}
