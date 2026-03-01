using MongoDB.Bson;
using MongoDB.Driver.GeoJsonObjectModel;

public class LocationCacheEntry
{
    public ObjectId Id { get; set; }
    public GeoJson2DGeographicCoordinates? Location { get; set; }
    public string? Name { get; set; }
    public string? WaterType { get; set; }
    public string? Description { get; set; }
    public DateTime CachedAt { get; set; }
}