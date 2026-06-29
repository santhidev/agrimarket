using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace AgriMarket.Products;

/// <summary>
/// Public product browse — no admin rights required.
/// Auto-exposed at <c>/api/app/product/*</c> by ABP convention routing.
/// </summary>
public interface IProductAppService : IApplicationService
{
    /// <summary>Get all active products with their grades.</summary>
    Task<ListResultDto<ProductDto>> GetListAsync();

    /// <summary>Get a single product by ID, including its grades.</summary>
    Task<ProductDto> GetAsync(Guid id);

    /// <summary>Get grades for a specific product.</summary>
    Task<ListResultDto<ProductGradeDto>> GetGradesAsync(Guid id);
}
