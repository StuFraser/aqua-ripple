using AquaRipple.Api.Models;
using MongoDB.Driver;
using MongoDB.Bson;
using System.Text.Json;
using System.Text.Json.Serialization;
using MongoDB.Driver.GeoJsonObjectModel;


namespace AquaRipple.Api.Services;

public class LocationService
{
    private readonly HttpClient _httpClient;
    private readonly IMongoCollection<LocationCacheEntry> _cache;
    private readonly ILogger<LocationService> _logger;

public LocationService(
    IHttpClientFactory httpClientFactory,
    IMongoDatabase database,
    ILogger<LocationService> logger)
{
    _httpClient = httpClientFactory.CreateClient("Analytics");
    _logger = logger;

    _cache = database.GetCollection<LocationCacheEntry>("location_cache");

    var indexModel = new CreateIndexModel<LocationCacheEntry>(
        Builders<LocationCacheEntry>.IndexKeys.Geo2DSphere(x => x.Location));
    _cache.Indexes.CreateOne(indexModel);
}

    public async Task<LocationLookupResponse> LookupAsync(double latitude, double longitude)
    {
        try
        {
            // 1. Check cache first
            var cached = await GetCachedAsync(latitude, longitude);
            if (cached != null)
            {
                _logger.LogInformation("Cache hit for {Lat}, {Lon}: {Name}", latitude, longitude, cached.Name);
                return new LocationLookupResponse(
                    IsWaterBody: true,
                    WaterBodyName: cached.Name,
                    Message: null
                );
            }

            // 2. Cache miss — ask analytics service (Gemini)
            var payload = JsonSerializer.Serialize(new { lat = latitude, lon = longitude });
            var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("location/lookup", content);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("Analytics location response: {Json}", json);

            var result = JsonSerializer.Deserialize<AnalyticsLocationResult>(json)
                ?? throw new InvalidOperationException("Null response from analytics service.");

            // 3. If water, save to cache
            if (result.IsWater)
            {
                await SaveCacheAsync(latitude, longitude, result);
            }

            return new LocationLookupResponse(
                IsWaterBody: result.IsWater,
                WaterBodyName: result.Name,
                Message: result.Message
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error looking up location for {Lat}, {Lon}", latitude, longitude);
            throw;
        }
    }

    private async Task<LocationCacheEntry?> GetCachedAsync(double latitude, double longitude)
    {
        var filter = Builders<LocationCacheEntry>.Filter.NearSphere(
            x => x.Location,
            longitude, latitude,
            maxDistance: 100  // metres
        );

        return await _cache.Find(filter).FirstOrDefaultAsync();
    }

private async Task SaveCacheAsync(double latitude, double longitude, AnalyticsLocationResult result)
{
    var entry = new LocationCacheEntry
    {
        Location = GeoJson.Point(GeoJson.Geographic(longitude, latitude)).Coordinates,
        Name = result.Name,
        WaterType = result.WaterType,
        Description = result.Description,
        CachedAt = DateTime.UtcNow
    };

    await _cache.InsertOneAsync(entry);
    _logger.LogInformation("Cached water body '{Name}' at {Lat}, {Lon}", result.Name, latitude, longitude);
}

    private record AnalyticsLocationResult(
        [property: JsonPropertyName("is_water")] bool IsWater,
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("water_type")] string? WaterType,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("message")] string? Message
    );
}
