using AquaRipple.Api.Models;
using System.Text.Json.Serialization;

namespace AquaRipple.Api.Models;
public record WaterCheckResponse(
    [property: JsonPropertyName("is_water")] bool IsWater,
    string? Name,
    string? Subtype,
    string? Class,
    string? Category,
    [property: JsonPropertyName("is_salt")] bool? IsSalt,
    [property: JsonPropertyName("is_intermittent")] bool? IsIntermittent,
    string? Confidence,
    [property: JsonPropertyName("nearest_water")] NearestWater? NearestWater
);