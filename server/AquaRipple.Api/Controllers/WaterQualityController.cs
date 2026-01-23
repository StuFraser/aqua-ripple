using Microsoft.AspNetCore.Mvc;
using AquaRipple.Api.Models;
using AquaRipple.Api.Services;

namespace AquaRipple.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WaterQualityController : ControllerBase
{
    private readonly WaterQualityService _service;

    public WaterQualityController(WaterQualityService service)
    {
        _service = service;
    }

    // GET: api/WaterQuality
    [HttpGet]
    public async Task<List<WaterReport>> Get() =>
        await _service.GetAsync();

    // GET: api/WaterQuality/{id}
    [HttpGet("{id:length(24)}")]
    public async Task<ActionResult<WaterReport>> Get(string id)
    {
        var report = await _service.GetByIdAsync(id);
        if (report is null) return NotFound();
        return report;
    }

    // POST: api/WaterQuality
    [HttpPost]
    public async Task<IActionResult> Post(WaterReport newReport)
    {
        // Ensure the Guid is generated if not provided
        if (newReport.ReportId == Guid.Empty) 
            newReport = newReport with { ReportId = Guid.NewGuid() };

        await _service.CreateAsync(newReport);
        return CreatedAtAction(nameof(Get), new { id = newReport.Id }, newReport);
    }
}