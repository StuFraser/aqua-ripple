using AquaRipple.Api.Models;
using MongoDB.Driver;

namespace AquaRipple.Api.Services;

public class WaterQualityService
{
    private readonly IMongoCollection<WaterReport> _reportsCollection;

    public WaterQualityService(IMongoDatabase database)
    {
        // This links the service to the "Reports" collection in Mongo
        _reportsCollection = database.GetCollection<WaterReport>("Reports");
    }

    public async Task<List<WaterReport>> GetAsync() =>
        await _reportsCollection.Find(_ => true).ToListAsync();

    public async Task CreateAsync(WaterReport newReport) =>
        await _reportsCollection.InsertOneAsync(newReport);

    public async Task<WaterReport?> GetByIdAsync(string id) =>
        await _reportsCollection.Find(x => x.Id == id).FirstOrDefaultAsync();
}