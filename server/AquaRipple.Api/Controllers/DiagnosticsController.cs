using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;

namespace AquaRipple.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class DiagnosticsController : ControllerBase
{
    private readonly IMongoDatabase _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public DiagnosticsController(
        IMongoDatabase db,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    [HttpGet("health-detail")]
    public async Task<IActionResult> HealthDetail()
    {
        var results = new Dictionary<string, object>();

        // Test MongoDB
        try
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            await _db.RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1));
            results["mongodb"] = new { status = "ok", ms = sw.ElapsedMilliseconds };
        }
        catch (Exception ex)
        {
            results["mongodb"] = new { status = "error", error = ex.Message };
        }

        // Test Analytics
        try
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var analyticsUrl = _configuration["Analytics:BaseUrl"];
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            var response = await client.GetAsync(analyticsUrl);
            results["analytics"] = new { status = (int)response.StatusCode, ms = sw.ElapsedMilliseconds };
        }
        catch (Exception ex)
        {
            results["analytics"] = new { status = "error", error = ex.Message };
        }

        return Ok(results);
    }
}