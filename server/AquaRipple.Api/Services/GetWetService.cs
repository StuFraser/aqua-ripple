using System.Text.Json;
using AquaRipple.Api.Models;
namespace AquaRipple.Api.Services;

public class GetWetService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<GetWetService> _logger;

    public GetWetService(IHttpClientFactory httpClientFactory, ILogger<GetWetService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public void WarmCache(double latitude, double longitude)
    {
        // Intentionally not awaited — fire and forget
        _ = WarmCacheAsync(latitude, longitude);
    }

    public async Task<string> WarmCacheAsync(double latitude, double longitude)
    {
        var client = _httpClientFactory.CreateClient("GetWet");
        var response = await client.PostAsync(
            $"/cache/warm?lat={latitude}&lng={longitude}",
            null);
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync();
        _logger.LogInformation("GetWet warm completed {Status} for ({Lat}, {Lon})",
            response.StatusCode, latitude, longitude);
        return content;
    }

    public async Task<WaterCheckResponse?> CheckAsync(double latitude, double longitude, int marginMetres = 10)
    {
        var client = _httpClientFactory.CreateClient("GetWet");
        var response = await client.GetAsync(
            $"/water/check?lat={latitude}&lng={longitude}&margin_m={marginMetres}");
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<WaterCheckResponse>(
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        _logger.LogInformation("GetWet check completed for ({Lat}, {Lon}): isWater={IsWater}",
            latitude, longitude, content?.IsWater);
        return content;
    }
}