namespace AquaRipple.Api.Models;

public record LocationLookupResponse(
    bool IsWaterBody,
    string? WaterBodyName,
    string? Message
);