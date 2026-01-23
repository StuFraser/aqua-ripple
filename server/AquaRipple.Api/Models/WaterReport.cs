using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AquaRipple.Api.Models;
public record WaterReport(
    [property: BsonId]
    [property: BsonRepresentation(BsonType.ObjectId)]
    string? Id,
    Guid ReportId,
    Location Location,
    DateTime Timestamp,
    string ReportedBy,
    WaterMetrics Metrics,
    string VisualObservations,
    string Status = "Pending"
);
