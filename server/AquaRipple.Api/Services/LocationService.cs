using AquaRipple.Api.Models;
using System.Text.Json;

namespace AquaRipple.Api.Services;

public class LocationService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<LocationService> _logger;

    public LocationService(IHttpClientFactory httpClientFactory, ILogger<LocationService> logger)
    {
        _httpClient = httpClientFactory.CreateClient("Overpass");
        _logger = logger;
    }

    public async Task<LocationLookupResponse> LookupAsync(double latitude, double longitude)
    {
        try
        {
            // Query Overpass for any water body within 50m of the given coordinates
            var query = $@"
                    [out:json];
                    is_in({latitude},{longitude})->.a;
                    (
                    way(pivot.a)[""natural""=""water""];
                    way(pivot.a)[""water""];
                    relation(pivot.a)[""natural""=""water""];
                    relation(pivot.a)[""water""];
                    );
                    out tags;";

            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("data", query)
            });

            var response = await _httpClient.PostAsync("interpreter", content);
            var json = await response.Content.ReadAsStringAsync();

            _logger.LogInformation("Overpass response: {Json}", json);

            var document = JsonSerializer.Deserialize<JsonElement>(json);
            var elements = document.GetProperty("elements");

            if (elements.GetArrayLength() == 0)
            {
                return new LocationLookupResponse(
                    IsWaterBody: false,
                    WaterBodyName: null,
                    Message: "The selected location does not appear to be a water body. Please drop your pin on a lake, river, or other waterway."
                );
            }

            // Grab the name from the first matching element's tags
            var firstElement = elements[0];
            var name = firstElement.TryGetProperty("tags", out var tags) &&
                       tags.TryGetProperty("name", out var nameProp)
                ? nameProp.GetString()
                : null;

            return new LocationLookupResponse(
                IsWaterBody: true,
                WaterBodyName: name ?? "Unknown Water Body",
                Message: null
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error looking up location for {Lat}, {Lon}", latitude, longitude);
            throw;
        }
    }
}