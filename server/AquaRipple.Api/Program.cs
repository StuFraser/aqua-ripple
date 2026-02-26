using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;
using MongoDB.Bson;
using MongoDB.Driver;
using AquaRipple.Api.Models;
using AquaRipple.Api.Services;

var builder = WebApplication.CreateBuilder(args);


// Force MongoDB to store GUIDs as readable strings
BsonSerializer.RegisterSerializer(new GuidSerializer(BsonType.String));

// Add services to the container.

var mongoSettings = builder.Configuration.GetSection("MongoDbSettings");

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
//builder.Services.AddSwaggerGen();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo { Title = "AquaRipple API", Version = "v1" });
    
    // This forces Swagger to look at the actual classes in your project
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }
});
builder.Services.AddSingleton<IMongoClient>(_ => new MongoClient(mongoSettings["ConnectionString"]));
builder.Services.AddScoped(sp => {
    var client = sp.GetRequiredService<IMongoClient>();
    return client.GetDatabase(mongoSettings["DatabaseName"]);
});
builder.Services.AddScoped<WaterQualityService>();

builder.Services.AddHttpClient("Overpass", client =>
{
    client.BaseAddress = new Uri("https://overpass-api.de/api/");
    client.DefaultRequestHeaders.Add("User-Agent", "AquaRipple/1.0");
});
builder.Services.AddScoped<LocationService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowClient", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();
app.UseCors("AllowClient");
app.MapControllers();

var builder_debug = WebApplication.CreateBuilder(args);
using (var serviceScope = app.Services.CreateScope())
{
    var actionProvider = serviceScope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Mvc.Infrastructure.IActionDescriptorCollectionProvider>();
    foreach (var action in actionProvider.ActionDescriptors.Items)
    {
        Console.WriteLine($"Found Route: {action.AttributeRouteInfo?.Template} -> {action.DisplayName}");
    }
}

app.Run();
