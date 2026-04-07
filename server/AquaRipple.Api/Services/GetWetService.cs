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

    /// <summary>
    /// Checks whether the given coordinates are on a water body.
    /// Throws <see cref="HttpRequestException"/> (propagated from EnsureSuccessStatusCode)
    /// so the global exception middleware can map status codes — including 429 rate limits —
    /// back to the client correctly.
    /// </summary>
    public async Task<ContentResult> CheckAsync(double latitude, double longitude, int marginMetres = 10)
    {
        _logger.LogDebug("GetWet check starting | lat={Lat} lon={Lon} margin={Margin}m",
            latitude, longitude, marginMetres);

        var client = _httpClientFactory.CreateClient("GetWet");

        HttpResponseMessage response;
        try
        {
            response = await client.GetAsync(
                $"/water/check?lat={latitude}&lng={longitude}&margin_m={marginMetres}");
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogWarning(ex, "GetWet check timed out | lat={Lat} lon={Lon}", latitude, longitude);
            throw; // Handled by GlobalExceptionMiddleware → 504
        }

        // Let HttpRequestException propagate — the global handler maps 429 → 429, 5xx → 502, etc.
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        _logger.LogInformation("GetWet check completed | lat={Lat} lon={Lon} statusCode={StatusCode}",
            latitude, longitude, (int)response.StatusCode);

        return new ContentResult
        {
            Content = json,
            ContentType = "application/json",
            StatusCode = 200
        };
    }

    /// <summary>
    /// Warms the GetWet tile cache for the given coordinates.
    /// Errors are logged and propagated so callers can decide whether to surface them.
    /// </summary>
    public async Task<string> WarmCacheAsync(double latitude, double longitude)
    {
        _logger.LogDebug("GetWet cache warm starting | lat={Lat} lon={Lon}", latitude, longitude);

        var client = _httpClientFactory.CreateClient("GetWet");

        HttpResponseMessage response;
        try
        {
            response = await client.PostAsync(
                $"/cache/warm?lat={latitude}&lng={longitude}", null);
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogWarning(ex, "GetWet warm timed out | lat={Lat} lon={Lon}", latitude, longitude);
            throw;
        }

        response.EnsureSuccessStatusCode();

        _logger.LogInformation("GetWet cache warm completed | lat={Lat} lon={Lon}", latitude, longitude);
        return await response.Content.ReadAsStringAsync();
    }
}