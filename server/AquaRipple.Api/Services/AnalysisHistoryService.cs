using AquaRipple.Api.Models;
using MongoDB.Driver;
using MongoDB.Driver.GeoJsonObjectModel;

namespace AquaRipple.Api.Services;

public class AnalysisHistoryService
{
    private readonly IMongoCollection<WaterQualityRecord> _collection;
    private readonly ILogger<AnalysisHistoryService> _logger;
    private readonly double _radiusKm;
    private readonly int _cacheWindowHours;
    private readonly int _maxRecords;

    public AnalysisHistoryService(
        IMongoDatabase database,
        IConfiguration config,
        ILogger<AnalysisHistoryService> logger)
    {
        _logger = logger;

        var collectionName = config["MongoDbSettings:HistoryCollectionName"]
            ?? throw new InvalidOperationException("MongoDbSettings:HistoryCollectionName is not configured.");

        _radiusKm = config.GetValue<double>("LocationMatch:RadiusKm", 2.0);
        _cacheWindowHours = config.GetValue<int>("LocationMatch:CacheWindowHours", 24);
        _maxRecords = config.GetValue<int>("LocationMatch:MaxRecordsPerLocation", 3);

        _collection = database.GetCollection<WaterQualityRecord>(collectionName);

        EnsureIndexes();

        _logger.LogInformation(
            "AnalysisHistoryService ready | radius={RadiusKm}km window={CacheWindowHours}h max={MaxRecords}",
            _radiusKm, _cacheWindowHours, _maxRecords);
    }

    private void EnsureIndexes()
    {
        var indexes = new List<CreateIndexModel<WaterQualityRecord>>
        {
            new(Builders<WaterQualityRecord>.IndexKeys
                .Ascending(r => r.WaterBodyName)
                .Ascending(r => r.Mode)
                .Descending(r => r.RecordedAt)),

            new(Builders<WaterQualityRecord>.IndexKeys
                .Ascending(r => r.Latitude)
                .Ascending(r => r.Longitude)),
        };

        _collection.Indexes.CreateMany(indexes);
    }

    /// <summary>
    /// Finds the most recent existing record matching by name + proximity within the cache
    /// window, regardless of which mode/engine produced it — the caller's requested mode
    /// doesn't need to match. The record still carries its own Mode/Fallback, so whichever
    /// engine actually produced it is surfaced accurately rather than assumed.
    /// Returns null if no match found.
    /// </summary>
    public async Task<WaterQualityRecord?> FindMatchAsync(string waterBodyName, double lat, double lon)
    {
        var windowStart = DateTime.UtcNow.AddHours(-_cacheWindowHours);

        var filter = Builders<WaterQualityRecord>.Filter.And(
            Builders<WaterQualityRecord>.Filter.Regex(
                r => r.WaterBodyName,
                new MongoDB.Bson.BsonRegularExpression($"^{System.Text.RegularExpressions.Regex.Escape(waterBodyName)}$", "i")),
            Builders<WaterQualityRecord>.Filter.Gte(r => r.RecordedAt, windowStart)
        );

        var candidates = await _collection
            .Find(filter)
            .SortByDescending(r => r.RecordedAt)
            .ToListAsync();

        // Apply proximity filter in memory — candidate set is small (max 3 per mode per location)
        return candidates.FirstOrDefault(r => HaversineKm(lat, lon, r.Latitude, r.Longitude) <= _radiusKm);
    }

    /// <summary>
    /// Saves a new record and evicts the oldest if the sliding window is exceeded.
    /// Mode and Fallback reflect what the analytics service actually used, which may
    /// differ from what the caller requested (e.g. an AI request that fell back to rules).
    /// </summary>
    public async Task SaveAsync(string waterBodyName, double lat, double lon, string resultJson, string mode, bool fallback)
    {
        var record = new WaterQualityRecord
        {
            WaterBodyName = waterBodyName,
            Latitude = lat,
            Longitude = lon,
            RecordedAt = DateTime.UtcNow,
            Mode = mode,
            Fallback = fallback,
            ResultJson = resultJson,
        };

        await _collection.InsertOneAsync(record);

        _logger.LogInformation(
            "Saved analysis record | waterBody={WaterBodyName} lat={Lat} lon={Lon} mode={Mode} fallback={Fallback}",
            waterBodyName, lat, lon, mode, fallback);

        await EvictOldestIfOverLimitAsync(waterBodyName, lat, lon, mode);
    }

    /// <summary>
    /// Returns records for a location, newest first. Pass <paramref name="mode"/> to restrict
    /// to one engine (used internally for per-mode eviction accounting); omit it to return the
    /// full history across all modes/engines for display — each record still carries its own
    /// Mode/Fallback so the caller can label the source per entry rather than assuming one.
    /// </summary>
    public async Task<List<WaterQualityRecord>> GetHistoryAsync(string waterBodyName, double lat, double lon, string? mode = null)
    {
        var nameFilter = Builders<WaterQualityRecord>.Filter.Regex(
            r => r.WaterBodyName,
            new MongoDB.Bson.BsonRegularExpression($"^{System.Text.RegularExpressions.Regex.Escape(waterBodyName)}$", "i"));

        var filter = mode == null
            ? nameFilter
            : Builders<WaterQualityRecord>.Filter.And(nameFilter, Builders<WaterQualityRecord>.Filter.Eq(r => r.Mode, mode));

        var all = await _collection
            .Find(filter)
            .SortByDescending(r => r.RecordedAt)
            .ToListAsync();

        return all
            .Where(r => HaversineKm(lat, lon, r.Latitude, r.Longitude) <= _radiusKm)
            .ToList();
    }

    private async Task EvictOldestIfOverLimitAsync(string waterBodyName, double lat, double lon, string mode)
    {
        // Scoped to `mode` so each engine's history is capped independently — the combined
        // display list can therefore hold up to _maxRecords per mode, not _maxRecords total.
        var all = await GetHistoryAsync(waterBodyName, lat, lon, mode);

        if (all.Count <= _maxRecords) return;

        var toDelete = all
            .OrderBy(r => r.RecordedAt)
            .Take(all.Count - _maxRecords)
            .Select(r => r.Id)
            .ToList();

        var deleteFilter = Builders<WaterQualityRecord>.Filter.In(
            r => r.Id, toDelete);

        var deleted = await _collection.DeleteManyAsync(deleteFilter);

        _logger.LogInformation(
            "Evicted {Count} old record(s) for {WaterBodyName}",
            deleted.DeletedCount, waterBodyName);
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0;
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2))
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double ToRad(double deg) => deg * Math.PI / 180.0;
}