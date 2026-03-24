using Microsoft.AspNetCore.Mvc;
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

    public async Task<ContentResult> CheckAsync(double latitude, double longitude, int marginMetres = 10)
    {
        var client = _httpClientFactory.CreateClient("GetWet");
        var response = await client.GetAsync(
            $"/water/check?lat={latitude}&lng={longitude}&margin_m={marginMetres}");
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        _logger.LogInformation("GetWet check completed for ({Lat}, {Lon})", latitude, longitude);

        return new ContentResult
        {
            Content = json,
            ContentType = "application/json",
            StatusCode = 200
        };
    }

    public async Task<string> WarmCacheAsync(double latitude, double longitude)
    {
        var client = _httpClientFactory.CreateClient("GetWet");
        var response = await client.PostAsync(
            $"/cache/warm?lat={latitude}&lng={longitude}", null);
        response.EnsureSuccessStatusCode();

        _logger.LogInformation("GetWet warm completed for ({Lat}, {Lon})", latitude, longitude);
        return await response.Content.ReadAsStringAsync();
    }
}