namespace AquaRipple.Api.Models;

/// <summary>
/// A single result from the GeoNames search endpoint, used for map search autocomplete.
/// </summary>
public record GeoSearchResult(
    string Name,
    string DisplayName,
    double Latitude,
    double Longitude,
    bool IsWater,
    string FeatureType
);