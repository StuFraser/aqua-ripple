using Microsoft.AspNetCore.Mvc;
using AquaRipple.Api.Models;
using AquaRipple.Api.Services;

namespace AquaRipple.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LocationController : ControllerBase
{
    private readonly LocationService _locationService;

    public LocationController(LocationService locationService)
    {
        _locationService = locationService;
    }

    [HttpPost]
    public async Task<IActionResult> Post([FromBody] LocationLookupRequest request)
    {
        var result = await _locationService.LookupAsync(request.Latitude, request.Longitude);
        return Ok(result);
    }
}