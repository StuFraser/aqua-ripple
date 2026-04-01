using System.Text.Json;

namespace AquaRipple.Api.Models;

public class LocationAnalysisResponse
{
    public JsonElement Current { get; set; }
    public List<JsonElement> History { get; set; } = new();
}