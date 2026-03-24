using Microsoft.AspNetCore.Mvc;
using AquaRipple.Api.Models;
using AquaRipple.Api.Services;

namespace AquaRipple.Api.Controllers;

/// <summary>
/// Exposes GeoNames functionality to the client. The client should never
/// talk to GeoNames directly — all external calls are mediated here.
/// </summary>
[ApiController]
[Route("api/geonames")]
public class GeoNamesController : ControllerBase
{
    private readonly GeoNamesService _geoNamesService;

    public GeoNamesController(GeoNamesService geoNamesService)
    {
        _geoNamesService = geoNamesService;
    }

    /// <summary>
    /// Searches for water bodies and places matching a query string.
    /// Used by the client map search bar for autocomplete.
    /// GET /api/geonames/search?q=waikato&maxRows=8
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult<List<GeoSearchResult>>> Search(
        [FromQuery] string q,
        [FromQuery] int maxRows = 10)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Ok(new List<GeoSearchResult>());

        var results = await _geoNamesService.SearchAsync(q, maxRows);
        return Ok(results);
    }

    /// <summary>
    /// Deprecated — use POST /api/getwet/check instead.
    /// GeoNames radius-based detection proved unreliable for point detection.
    /// </summary>
    [Obsolete("Use GetWetService for point detection.")]
    [HttpPost("water-detect")]
    public async Task<ActionResult<LocationLookupResponse>> WaterDetect([FromBody] LocationRequest request)
    {
        var result = await _geoNamesService.CheckWaterBodyAsync(request.Latitude, request.Longitude);
        return Ok(result);
    }
}