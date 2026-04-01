using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AquaRipple.Api.Models;

public class WaterQualityRecord
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string WaterBodyName { get; set; } = null!;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime RecordedAt { get; set; }

    // The full analysis result from the analytics service — stored as raw JSON
    // so we're not duplicating the Python model in C# until we need to
    public string ResultJson { get; set; } = null!;
}