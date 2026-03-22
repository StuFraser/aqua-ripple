using System.Text;
using System.Text.Json;

namespace AquaRipple.Api.Services;

public class AnalysisService
{
    private readonly HttpClient _httpClient;

    public AnalysisService(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient("Analytics");
    }

    public async Task<object> AnalyseAsync(double latitude, double longitude)
    {
        var payload = JsonSerializer.Serialize(new { lat = latitude, lon = longitude });
        var content = new StringContent(payload, Encoding.UTF8, "application/json");

        Console.WriteLine($"Sending to analysis service: {payload}");
Console.WriteLine($"URL: {_httpClient.BaseAddress}analyse?analysis_mode=true");

        var response = await _httpClient.PostAsync(
            "analyse?analysis_mode=true", content);

        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<object>(json)!;
    }
}