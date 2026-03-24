using System.Text.Json;
using AquaRipple.Api.Models;

namespace AquaRipple.Api.Services;

/// <summary>
/// Wraps the GeoNames REST API for two purposes:
///   1. Water-body detection via findNearbyJSON (featureClass=H)
///   2. Place-name search via searchJSON
/// </summary>
public class GeoNamesService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<GeoNamesService> _logger;
    private readonly string _username;

    // GeoNames feature codes that represent meaningful water bodies.
    // See: https://www.geonames.org/export/codes.html  (class H)
    private static readonly HashSet<string> WaterFeatureCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "LK",   // lake
        "LKS",  // lakes
        "LKC",  // crater lake
        "LKN",  // salt lake
        "LKO",  // oxbow lake
        "LKX",  // section of lake
        "LKNI", // intermittent salt lake
        "LKOI", // intermittent oxbow lake
        "LKSI", // intermittent lakes
        "LKXI", // intermittent section of lake
        "LKFI", // intermittent lake (fresh)
        "STM",  // stream
        "STMH", // headwaters
        "STMI", // intermittent stream
        "STMIX",// section of intermittent stream
        "STMQ", // abandoned/dry stream
        "STMX", // section of stream
        "STMB", // stream bend
        "STMD", // distributary
        "STMS", // streams
        "STMSB",// lost river
        "STMM", // stream mouth
        "RVR",  // river (alias used in some datasets)
        "CNLSB",// canal (below-ground)
        "CNL",  // canal
        "CNLA", // aqueduct
        "CNLB", // canal bend
        "CNLD", // drainage canal
        "CNLI", // irrigation canal
        "CNLN", // navigation canal
        "CNLQ", // abandoned canal
        "CNLSB",// underground irrigation canal
        "CNLX", // section of canal
        "RSRV", // reservoir
        "RSRVI",// intermittent reservoir
        "BAY",  // bay
        "BAYS", // bays
        "COVE", // cove
        "GULF", // gulf
        "LAGN", // lagoon
        "ESTY", // estuary
        "CRKT", // tidal creek
        "HBR",  // harbour
        "INLT", // inlet
        "OCN",  // ocean
        "SEA",  // sea
        "SD",   // sound
        "POND", // pond
        "PNDS", // ponds
        "PNDNI",// intermittent salt pond
        "PNDI", // intermittent pond
        "PNDSF",// fishponds
        "PNDSA",// alkaline ponds
        "PNDSN",// salt ponds
        "SWMP", // swamp/marsh
        "MFGN", // salt evaporation ponds
        "MFGQ", // abandoned watermills
        "WTLD", // wetland
        "WTLDI",// intermittent wetland
        "FLLS", // waterfall(s)
        "FLLSX",// section of waterfall
        "RPDS", // rapids
        "DAM",  // dam
        "DIKE", // dike
        "SPNG", // spring
        "SPNS", // sulphur spring
        "SPNT", // hot spring
        "FJD",  // fjord
        "FJDS", // fjords
        "SPNT", // hot spring
    };

    public GeoNamesService(IHttpClientFactory httpClientFactory, ILogger<GeoNamesService> logger, IConfiguration config)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _username = config["GeoNames:Username"]
            ?? throw new InvalidOperationException("GeoNames:Username is not configured.");
    }

    /// <summary>
    /// Determines whether a lat/lon point is on or very close to a water body.
    /// 
    /// NOTE: Deprecated — do not use. GeoNames findNearby operates on a radius
    /// basis and proved unreliable for point detection, frequently returning false
    /// positives on land near water and missing smaller water bodies entirely.
    /// Use GetWetService.CheckAsync for point-based water detection instead.
    /// </summary>
    [Obsolete("Unreliable for point detection. Use GetWetService.CheckAsync instead.")]
    public async Task<LocationLookupResponse> CheckWaterBodyAsync(double lat, double lng, int radiusKm = 1)
    {
        var client = _httpClientFactory.CreateClient("GeoNames");
        var url = $"findNearbyJSON?lat={lat}&lng={lng}&featureClass=H&radius={radiusKm}&maxRows=5&username={_username}";

        try
        {
            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            using var stream = await response.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);

            if (!doc.RootElement.TryGetProperty("geonames", out var geonames))
            {
                _logger.LogWarning("GeoNames findNearby returned no 'geonames' array for ({Lat},{Lng})", lat, lng);
                return new LocationLookupResponse(false, null, "No nearby water features found.");
            }

            // Look for the first result that is a recognised water feature code
            foreach (var feature in geonames.EnumerateArray())
            {
                var fcl = feature.TryGetProperty("fcl", out var fclEl) ? fclEl.GetString() : null;
                var fcode = feature.TryGetProperty("fcode", out var fcEl) ? fcEl.GetString() : null;
                var name = feature.TryGetProperty("name", out var nameEl) ? nameEl.GetString() : null;
                var fclName = feature.TryGetProperty("fclName", out var fclNameEl) ? fclNameEl.GetString() : null;
                var fcodeName = feature.TryGetProperty("fcodeName", out var fcodeNameEl) ? fcodeNameEl.GetString() : null;

                if (fcl == "H" && fcode is not null && WaterFeatureCodes.Contains(fcode))
                {
                    var description = fcodeName ?? fclName ?? "Water body";
                    _logger.LogInformation("GeoNames water hit at ({Lat},{Lng}): {Name} [{FCode}]", lat, lng, name, fcode);
                    return new LocationLookupResponse(true, name, $"{description}");
                }
            }

            return new LocationLookupResponse(false, null, "Location does not appear to be on a water body.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GeoNames findNearby failed for ({Lat},{Lng})", lat, lng);
            return new LocationLookupResponse(false, null, "Unable to determine water body status.");
        }
    }

    /// <summary>
    /// Searches GeoNames for water bodies / places matching a query string.
    /// Returns up to maxRows results suitable for map search autocomplete.
    /// </summary>
    public async Task<List<GeoSearchResult>> SearchAsync(string query, int maxRows = 10)
    {
        var client = _httpClientFactory.CreateClient("GeoNames");
        // Search preferring water bodies (featureClass=H) but also accepting other features
        var url = $"searchJSON?q={Uri.EscapeDataString(query)}&maxRows={maxRows}&username={_username}&orderby=relevance&featureClass=H";

        try
        {
            var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            using var stream = await response.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);

            var results = new List<GeoSearchResult>();

            if (!doc.RootElement.TryGetProperty("geonames", out var geonames))
                return results;

            foreach (var feature in geonames.EnumerateArray())
            {
                var name = feature.TryGetProperty("name", out var nEl) ? nEl.GetString() : null;
                var country = feature.TryGetProperty("countryName", out var cEl) ? cEl.GetString() : null;
                var fcl = feature.TryGetProperty("fcl", out var fclEl) ? fclEl.GetString() : null;
                var fcodeName = feature.TryGetProperty("fcodeName", out var fnEl) ? fnEl.GetString() : null;
                var adminName = feature.TryGetProperty("adminName1", out var aEl) ? aEl.GetString() : null;

                double lat = 0, lng = 0;
                if (feature.TryGetProperty("lat", out var latEl)) double.TryParse(latEl.GetString(), out lat);
                if (feature.TryGetProperty("lng", out var lngEl)) double.TryParse(lngEl.GetString(), out lng);

                if (name is null || (lat == 0 && lng == 0)) continue;

                var displayName = BuildDisplayName(name, adminName, country);
                var isWater = fcl == "H";

                results.Add(new GeoSearchResult(name, displayName, lat, lng, isWater, fcodeName ?? fcl ?? "Place"));
            }

            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "GeoNames search failed for query '{Query}'", query);
            return new List<GeoSearchResult>();
        }
    }

    private static string BuildDisplayName(string name, string? admin, string? country)
    {
        var parts = new List<string> { name };
        if (!string.IsNullOrWhiteSpace(admin) && admin != name) parts.Add(admin);
        if (!string.IsNullOrWhiteSpace(country)) parts.Add(country);
        return string.Join(", ", parts);
    }
}