public class GeoJsonPoint
{
    public string Type { get; set; } = "Point";
    public double[] Coordinates { get; set; }

    public GeoJsonPoint(double longitude, double latitude)
    {
        Coordinates = [longitude, latitude];  // GeoJSON is always lon, lat
    }
}