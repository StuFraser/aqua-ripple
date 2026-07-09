namespace AquaRipple.Api.Models;

public class LocationRequest
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? WaterBodyName { get; set; }

    /// <summary>"ai" or "rules" — which analysis path to use. Defaults to the free, rate-limit-free rules engine.</summary>
    public string Mode { get; set; } = "rules";
}