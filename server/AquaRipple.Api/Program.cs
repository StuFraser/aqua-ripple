using AquaRipple.Api.Authentication;
using AquaRipple.Api.Models;
using AquaRipple.Api.Services;
using Microsoft.AspNetCore.Authorization;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;
using MongoDB.Driver;

var builder = WebApplication.CreateBuilder(args);

BsonSerializer.RegisterSerializer(new GuidSerializer(BsonType.String));
var mongoSettings = builder.Configuration.GetSection("MongoDbSettings");

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo { Title = "AquaRipple API", Version = "v1" });

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        c.IncludeXmlComments(xmlPath);
    }
});
builder.Services.AddSingleton<IMongoClient>(_ => new MongoClient(mongoSettings["ConnectionString"]));
builder.Services.AddScoped(sp =>
{
    var client = sp.GetRequiredService<IMongoClient>();
    return client.GetDatabase(mongoSettings["DatabaseName"]);
});
builder.Services.AddScoped<GetWetService>();
builder.Services.AddScoped<GeoNamesService>();
builder.Services.AddScoped<AnalysisService>();


builder.Services.AddHttpClient("Analytics", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Analytics:BaseUrl"]
        ?? throw new InvalidOperationException("Analytics:BaseUrl is not configured."));
    client.Timeout = TimeSpan.FromSeconds(60);
});

builder.Services.AddHttpClient("GetWet", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["GetWet:BaseUrl"]
        ?? throw new InvalidOperationException("GetWet:BaseUrl is not configured."));
    client.DefaultRequestHeaders.Add("x-api-key", builder.Configuration["GetWet:ApiKey"]
        ?? throw new InvalidOperationException("GetWet:ApiKey is not configured."));
    client.Timeout = TimeSpan.FromSeconds(60);
});

builder.Services.AddHttpClient("GeoNames", client =>
{
    client.BaseAddress = new Uri("https://secure.geonames.org/");
    client.Timeout = TimeSpan.FromSeconds(10);
});

builder.Services
    .AddAuthentication("ApiKey")
    .AddScheme<ApiKeyAuthenticationSchemeOptions, ApiKeyAuthenticationHandler>("ApiKey", null);
    
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

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
app.UseCors("AllowClient");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
