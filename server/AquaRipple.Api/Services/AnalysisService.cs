using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace AquaRipple.Api.Services;

public class AnalysisService
{
    private readonly HttpClient _httpClient;

    public AnalysisService(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient("Analytics");
    }

    public async Task<ContentResult> AnalyseAsync(double latitude, double longitude)
    {
        var payload = JsonSerializer.Serialize(new { lat = latitude, lon = longitude });
        var content = new StringContent(payload, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("analyse?analysis_mode=true", content);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        return new ContentResult 
        { 
            Content = json, 
            ContentType = "application/json", 
            StatusCode = 200 
        };
    }
}