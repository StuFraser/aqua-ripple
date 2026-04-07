using System.Text.Json;
using System.Text;
using AquaRipple.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace AquaRipple.Api.Services;

public class AnalysisService
{
    private readonly HttpClient _httpClient;
    private readonly AnalysisHistoryService _historyService;
    private readonly ILogger<AnalysisService> _logger;

    public AnalysisService(
        IHttpClientFactory httpClientFactory,
        AnalysisHistoryService historyService,
        ILogger<AnalysisService> logger)
    {
        _httpClient = httpClientFactory.CreateClient("Analytics");
        _historyService = historyService;
        _logger = logger;
    }

    public async Task<LocationAnalysisResponse> AnalyseAsync(
        double latitude,
        double longitude,
        string? waterBodyName)
    {
        if (!string.IsNullOrWhiteSpace(waterBodyName))
        {
            var cached = await _historyService.FindMatchAsync(waterBodyName, latitude, longitude);
            if (cached != null)
            {
                _logger.LogInformation(
                    "Cache hit | waterBody={WaterBodyName} lat={Lat} lon={Lon}",
                    waterBodyName, latitude, longitude);

                var cachedHistory = await _historyService.GetHistoryAsync(waterBodyName, latitude, longitude);
                return BuildResponse(cached.ResultJson, cachedHistory, excludeId: cached.Id);
            }
        }

        // No cache hit — call analytics service
        var payload = JsonSerializer.Serialize(new { lat = latitude, lon = longitude });
        var content = new StringContent(payload, Encoding.UTF8, "application/json");

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.PostAsync("analyse?analysis_mode=true", content);
        }
        catch (TaskCanceledException ex)
        {
            _logger.LogWarning(ex, "Analytics service timed out | lat={Lat} lon={Lon}", latitude, longitude);
            throw; // GlobalExceptionMiddleware maps to 504
        }

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            var statusCode = (int)response.StatusCode;

            // 404 (no imagery) and 422 (insufficient water pixels) are expected domain
            // outcomes — not service errors. Log them at Warning, not Error.
            if (statusCode is 404 or 422)
                _logger.LogWarning(
                    "Analytics service returned expected non-success {StatusCode} | lat={Lat} lon={Lon} | detail={Body}",
                    statusCode, latitude, longitude, body);
            else
                _logger.LogError(
                    "Analytics service returned {StatusCode} | lat={Lat} lon={Lon} | body={Body}",
                    statusCode, latitude, longitude, body);

            // Preserve the upstream status code (e.g. 429 Groq rate limit → 429 to client)
            response.EnsureSuccessStatusCode();
        }

        var resultJson = await response.Content.ReadAsStringAsync();

        if (!string.IsNullOrWhiteSpace(waterBodyName))
        {
            await _historyService.SaveAsync(waterBodyName, latitude, longitude, resultJson);
            var history = await _historyService.GetHistoryAsync(waterBodyName, latitude, longitude);
            return BuildResponse(resultJson, history, excludeLatest: true);
        }

        return new LocationAnalysisResponse
        {
            Current = JsonSerializer.Deserialize<JsonElement>(resultJson),
            History = new List<JsonElement>()
        };
    }

    private static LocationAnalysisResponse BuildResponse(
        string currentJson,
        List<WaterQualityRecord> history,
        string? excludeId = null,
        bool excludeLatest = false)
    {
        var historyItems = history
            .Where(r => excludeId == null || r.Id != excludeId)
            .Skip(excludeLatest ? 1 : 0)
            .Select(r => JsonSerializer.Deserialize<JsonElement>(r.ResultJson))
            .ToList();

        return new LocationAnalysisResponse
        {
            Current = JsonSerializer.Deserialize<JsonElement>(currentJson),
            History = historyItems
        };
    }
}