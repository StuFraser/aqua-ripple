namespace AquaRipple.Api.Models;
public record WaterMetrics(
    double ClarityScore, 
    double Turbidity, 
    double Chlorophyll, 
    double WaterTemp
);