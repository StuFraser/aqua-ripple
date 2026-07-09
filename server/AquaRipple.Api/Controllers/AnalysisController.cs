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
    /// Proxies to the Python analysis service — downloads satellite imagery and runs
    /// water quality analysis for the given coordinates, via either the Groq LLM ("ai")
    /// or the deterministic spectral rules engine ("rules", the default).
    /// Rate limited via GlobalLimiter: max 3 concurrent globally, max 5/min per IP.
    /// </summary>
    [HttpPost("analyse")]
    public async Task<ActionResult<LocationAnalysisResponse>> Analyse([FromBody] LocationRequest request)
    {
        var result = await _analysisService.AnalyseAsync(
            request.Latitude,
            request.Longitude,
            request.WaterBodyName,
            request.Mode);

        return Ok(result);
    }
}