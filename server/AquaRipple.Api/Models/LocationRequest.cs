namespace AquaRipple.Api.Models;

public class LocationRequest
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? WaterBodyName { get; set; }
}