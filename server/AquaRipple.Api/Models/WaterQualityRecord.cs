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

    // "ai" or "rules" — the analysis path that actually produced ResultJson.
    // Not necessarily the mode the caller requested: an "ai" request that hit
    // Groq's rate limit is recorded here as "rules" with Fallback = true.
    public string Mode { get; set; } = null!;
    public bool Fallback { get; set; }

    // The full analysis result from the analytics service — stored as raw JSON
    // so we're not duplicating the Python model in C# until we need to
    public string ResultJson { get; set; } = null!;
}