using Microsoft.AspNetCore.Mvc;
using AquaRipple.Api.Services;
using AquaRipple.Api.Models;

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

    [HttpPost("warm")]
    public async Task<IActionResult> Warm([FromBody] LocationRequest request)
    {
        var result = await _getWetService.WarmCacheAsync(request.Latitude, request.Longitude);
        return Ok(result);
    }

    [HttpPost("check")]
    public async Task<IActionResult> Check([FromBody] LocationRequest request)
    {
        var result = await _getWetService.CheckAsync(request.Latitude, request.Longitude);
        return result;
    }
}