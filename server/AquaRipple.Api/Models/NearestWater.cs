namespace AquaRipple.Api.Models;
using System.Text.Json.Serialization;

public record NearestWater(
    string? Name,
    string? Category,
    string? Class,
    [property: JsonPropertyName("distance_m")] double? DistanceM
);
