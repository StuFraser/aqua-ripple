using AquaRipple.Api.Authentication;
using AquaRipple.Api.Middleware;
using AquaRipple.Api.Models;
using AquaRipple.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Http.Resilience;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;
using MongoDB.Driver;
using Polly;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// ── Serialisation ─────────────────────────────────────────────────────────────
BsonSerializer.RegisterSerializer(new GuidSerializer(BsonType.String));

// ── Configuration validation (fail fast at startup, not at first request) ─────
var mongoSettings = builder.Configuration.GetSection("MongoDbSettings");
ValidateRequiredConfig(builder.Configuration, [
    "MongoDbSettings:ConnectionString",
    "MongoDbSettings:DatabaseName",
    "MongoDbSettings:HistoryCollectionName",
    "Analytics:BaseUrl",
    "GetWet:BaseUrl",
    "GetWet:ApiKey",
    "GeoNames:Username",
    "ApiKey:Value",
]);

// ── MVC / Swagger ─────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo { Title = "AquaRipple API", Version = "v1" });
    c.AddSecurityDefinition("ApiKey", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Name = "X-API-Key",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Description = "API key authentication"
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "ApiKey"
                }
            },
            Array.Empty<string>()
        }
    });

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath)) c.IncludeXmlComments(xmlPath);
});

// ── MongoDB ───────────────────────────────────────────────────────────────────
builder.Services.AddSingleton<IMongoClient>(_ => new MongoClient(mongoSettings["ConnectionString"]));
builder.Services.AddScoped(sp =>
{
    var client = sp.GetRequiredService<IMongoClient>();
    return client.GetDatabase(mongoSettings["DatabaseName"]);
});

// ── Application services ──────────────────────────────────────────────────────
builder.Services.AddScoped<GetWetService>();
builder.Services.AddScoped<GeoNamesService>();
builder.Services.AddScoped<AnalysisService>();
builder.Services.AddScoped<AnalysisHistoryService>();

// ── Named HTTP clients with resilience pipelines ──────────────────────────────

// Analytics (Python FastAPI — satellite download + Groq LLM call)
// ┌─ No retry: operations are expensive, long-running, and mostly deterministic.
// │  429s need human-paced back-off; 422/404 are validation failures not worth retrying.
// └─ Circuit breaker only: stop hammering if the service is clearly down.
builder.Services.AddHttpClient("Analytics", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Analytics:BaseUrl"]!);
    client.Timeout = TimeSpan.FromSeconds(90); // generous — satellite download can be slow
})
.AddResilienceHandler("analytics-circuit-breaker", pipeline =>
{
    pipeline.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
    {
        // Open the circuit after 3 failures in a 60-second sampling window
        SamplingDuration = TimeSpan.FromSeconds(60),
        MinimumThroughput = 3,
        FailureRatio = 0.6,
        BreakDuration = TimeSpan.FromSeconds(30),

        // Only count genuine server/infra failures against the circuit.
        //   404 ImageryNotFoundError  — no satellite pass yet, not a service fault
        //   422 InsufficientWaterError — coordinates not over water, not a service fault
        //   429 LLMRateLimitError     — quota issue, not a service fault
        //   5xx / network            — actual service problems, count these
        ShouldHandle = args => ValueTask.FromResult(
            args.Outcome.Result?.StatusCode is
                System.Net.HttpStatusCode.InternalServerError or
                System.Net.HttpStatusCode.BadGateway or
                System.Net.HttpStatusCode.ServiceUnavailable or
                System.Net.HttpStatusCode.GatewayTimeout),
    });
});

// GetWet (fast idempotent water-detection checks)
// ┌─ Retry: cheap, fast, safe to retry on transient failures
// └─ Circuit breaker: don't block map clicks if the service goes down
builder.Services.AddHttpClient("GetWet", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["GetWet:BaseUrl"]!);
    client.DefaultRequestHeaders.Add("x-api-key", builder.Configuration["GetWet:ApiKey"]!);
    client.Timeout = TimeSpan.FromSeconds(60); 
})
.AddResilienceHandler("getwet-resilience", pipeline =>
{
    pipeline.AddRetry(new HttpRetryStrategyOptions
    {
        MaxRetryAttempts = 2,
        Delay = TimeSpan.FromMilliseconds(300),
        BackoffType = DelayBackoffType.Exponential,
        UseJitter = true,
        // Only retry transient failures — not 401/403/404/422/429
        ShouldHandle = args => ValueTask.FromResult(
            args.Outcome.Exception is HttpRequestException or TaskCanceledException ||
            (args.Outcome.Result?.StatusCode is
                System.Net.HttpStatusCode.InternalServerError or
                System.Net.HttpStatusCode.BadGateway or
                System.Net.HttpStatusCode.ServiceUnavailable or
                System.Net.HttpStatusCode.GatewayTimeout)),
    });

    pipeline.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
    {
        SamplingDuration = TimeSpan.FromSeconds(30),
        MinimumThroughput = 5,
        FailureRatio = 0.5,
        BreakDuration = TimeSpan.FromSeconds(20),
    });
});

// GeoNames (search autocomplete — cheap, read-only, public API)
// Same treatment as GetWet but shorter break duration (public API recovers quickly)
builder.Services.AddHttpClient("GeoNames", client =>
{
    client.BaseAddress = new Uri("https://secure.geonames.org/");
    client.Timeout = TimeSpan.FromSeconds(10);
})
.AddResilienceHandler("geonames-resilience", pipeline =>
{
    pipeline.AddRetry(new HttpRetryStrategyOptions
    {
        MaxRetryAttempts = 2,
        Delay = TimeSpan.FromMilliseconds(200),
        BackoffType = DelayBackoffType.Exponential,
        UseJitter = true,
        ShouldHandle = args => ValueTask.FromResult(
            args.Outcome.Exception is HttpRequestException or TaskCanceledException ||
            (args.Outcome.Result?.StatusCode is
                System.Net.HttpStatusCode.InternalServerError or
                System.Net.HttpStatusCode.BadGateway or
                System.Net.HttpStatusCode.ServiceUnavailable or
                System.Net.HttpStatusCode.GatewayTimeout)),
    });

    pipeline.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
    {
        SamplingDuration = TimeSpan.FromSeconds(30),
        MinimumThroughput = 5,
        FailureRatio = 0.5,
        BreakDuration = TimeSpan.FromSeconds(15),
    });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
builder.Services
    .AddAuthentication("ApiKey")
    .AddScheme<ApiKeyAuthenticationSchemeOptions, ApiKeyAuthenticationHandler>("ApiKey", null);

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowClient", policy =>
    {
        var allowedOrigins = builder.Configuration
            .GetSection("AllowedOrigins")
            .Get<string[]>() ?? [];

        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ── Health checks ─────────────────────────────────────────────────────────────
builder.Services.AddHealthChecks();

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Applied to the analysis endpoint only — the expensive Groq + satellite call.
// Two complementary policies chained together:
//
//   1. Concurrency limiter (global) — hard cap on simultaneous in-flight analysis
//      requests regardless of who is calling. Most important protection: prevents
//      a burst of requests queuing up 30-second jobs that exhaust Groq quota.
//
//   2. Sliding window per-IP — prevents a single client hammering the endpoint
//      even within the concurrency limit.
//
// NOTE: Both are in-process and therefore per-instance. If multiple instances
// are ever deployed, move the sliding window to Redis or the reverse proxy.
// The concurrency limiter can stay in-process — it protects per-instance resources.

builder.Services.AddRateLimiter(options =>
{
    // Return our structured ApiProblemDetail JSON instead of the default plain-text 429
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";

        var hasRetryAfter = context.Lease.TryGetMetadata(
            MetadataName.RetryAfter, out var retryAfter);

        if (hasRetryAfter)
            context.HttpContext.Response.Headers.RetryAfter =
                ((int)retryAfter.TotalSeconds).ToString();

        var errorCode = hasRetryAfter ? "RATE_LIMITED" : "CONCURRENCY_LIMIT";

        var problem = new
        {
            title = errorCode == "RATE_LIMITED"
                ? "Too many analysis requests. Please wait before trying again."
                : "Too many simultaneous analysis requests. Please try again in a moment.",
            status = 429,
            detail = errorCode == "RATE_LIMITED"
                ? $"Rate limit exceeded. Try again in {(hasRetryAfter ? $"{(int)retryAfter.TotalSeconds} seconds" : "a moment")}."
                : "The server is processing the maximum number of concurrent analyses.",
            errorCode,
            instance = context.HttpContext.Request.Path.ToString(),
        };

        await context.HttpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
    };

    // GlobalLimiter accepts a PartitionedRateLimiter<HttpContext> directly, which is
    // what CreateChained returns. We gate on the request path so only the analysis
    // endpoint is affected — all other routes get a no-op limiter.
    //
    // Two limiters run in sequence; both must grant a lease:
    //   1. Concurrency — global 3-slot pool, protects against burst queuing of 90s jobs
    //   2. Sliding window — per remote IP, 5 requests/minute
    options.GlobalLimiter = PartitionedRateLimiter.CreateChained(

        // Limiter 1: global concurrency — single "global" key so all IPs share the pool
        PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        {
            if (!ctx.Request.Path.StartsWithSegments("/api/analysis"))
                return RateLimitPartition.GetNoLimiter("bypass");

            return RateLimitPartition.GetConcurrencyLimiter("global", _ =>
                new ConcurrencyLimiterOptions
                {
                    PermitLimit = 3,
                    QueueLimit = 0,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                });
        }),

        // Limiter 2: per-IP sliding window — each IP gets its own counter
        PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        {
            if (!ctx.Request.Path.StartsWithSegments("/api/analysis"))
                return RateLimitPartition.GetNoLimiter("bypass");

            var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            return RateLimitPartition.GetSlidingWindowLimiter(ip, _ =>
                new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = 5,
                    Window = TimeSpan.FromMinutes(1),
                    SegmentsPerWindow = 4,
                    AutoReplenishment = true,
                    QueueLimit = 0,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                });
        })
    );
});

var app = builder.Build();

// ── Middleware pipeline ───────────────────────────────────────────────────────
// GlobalExceptionMiddleware MUST be first so it can catch exceptions from all
// subsequent middleware and produce a consistent structured error response.
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowClient");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Health check endpoint — excluded from auth so load balancers can probe it
app.MapHealthChecks("/health").AllowAnonymous();

app.MapControllers();

app.Run();

// ── Helpers ───────────────────────────────────────────────────────────────────

/// <summary>
/// Validates that all required configuration keys are present at startup.
/// Throws <see cref="InvalidOperationException"/> listing every missing key
/// so all problems are surfaced at once rather than discovered one at a time.
/// </summary>
static void ValidateRequiredConfig(IConfiguration config, string[] keys)
{
    var missing = keys.Where(k => string.IsNullOrWhiteSpace(config[k])).ToList();
    if (missing.Count > 0)
        throw new InvalidOperationException(
            $"Required configuration keys are missing or empty:\n  {string.Join("\n  ", missing)}");
}