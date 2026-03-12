using Microsoft.AspNetCore.Mvc;
using AquaRipple.Api.Services;
using AquaRipple.Api.Models;
using System.Threading.Tasks;

namespace AquaRipple.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GetWetController : ControllerBase
{
    private readonly GetWetService _getWetService;

    public GetWetController(GetWetService getWetService)
    {
        _getWetService = getWetService;
    }

    /// <summary>
    /// Fire-and-forget cache warm for a lat/lon location in GetWet.
    /// Returns immediately — the warm call runs in the background.
    /// </summary>
    [HttpPost("warm")]
    public async Task<IActionResult> Warm([FromBody] LocationRequest request)
    {
        var result = await _getWetService.WarmCacheAsync(request.Latitude, request.Longitude);
        return Ok(result);
    }

    /// <summary>
    /// Hits GetWet check method, used to detect if current point is a body of water or not
    /// </summary>
    /// <param name="request"> Lat/Long pair</param>
    /// <returns>JSon object</returns>
    [HttpPost("check")]
    public async Task<IActionResult> Check([FromBody] LocationRequest request)
    {
        var result = await _getWetService.CheckAsync(request.Latitude, request.Longitude);
        return Ok(result);
    }
}