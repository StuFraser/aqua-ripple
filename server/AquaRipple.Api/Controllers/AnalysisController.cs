using Microsoft.AspNetCore.Mvc;
using AquaRipple.Api.Services;
using AquaRipple.Api.Models;

namespace AquaRipple.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AnalysisController : ControllerBase
{
    private readonly AnalysisService _analysisService;

    public AnalysisController(AnalysisService analysisService)
    {
        _analysisService = analysisService;
    }

    /// <summary>
    /// Proxies to the Python analysis service — downloads satellite imagery
    /// and runs Gemini AI analysis for the given coordinates.
    /// </summary>
    [HttpPost("analyse")]
    public async Task<IActionResult> Analyse([FromBody] LocationRequest request)
    {
        var result = await _analysisService.AnalyseAsync(request.Latitude, request.Longitude);
        return Ok(result);
    }
}