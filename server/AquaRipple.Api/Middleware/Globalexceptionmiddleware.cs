using System.Net;
using System.Text.Json;
using Polly.CircuitBreaker;

namespace AquaRipple.Api.Middleware;

/// <summary>
/// Global exception handler that catches all unhandled exceptions and maps them
/// to consistent, structured JSON problem responses. Specific external-service
/// errors (rate limits, timeouts, bad gateway) are surfaced with meaningful
/// HTTP status codes so the UI can react appropriately.
/// </summary>
public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, errorCode, title) = ClassifyException(exception);

        // Log at appropriate level — rate limits and timeouts are warnings, everything else is an error
        if (statusCode == StatusCodes.Status429TooManyRequests
            || statusCode == StatusCodes.Status504GatewayTimeout
            || (statusCode == StatusCodes.Status503ServiceUnavailable && (exception is BrokenCircuitException or IsolatedCircuitException)))
        {
            _logger.LogWarning(exception,
                "External service constraint | Path={Path} StatusCode={StatusCode} ErrorCode={ErrorCode}",
                context.Request.Path, statusCode, errorCode);
        }
        else if (statusCode == StatusCodes.Status404NotFound || statusCode == StatusCodes.Status422UnprocessableEntity)
        {
            // Expected domain outcomes from the analytics service — not errors
            _logger.LogInformation(exception,
                "Analytics domain outcome | Path={Path} StatusCode={StatusCode} ErrorCode={ErrorCode}",
                context.Request.Path, statusCode, errorCode);
        }
        else if (statusCode >= 500)
        {
            _logger.LogError(exception,
                "Unhandled exception | Path={Path} StatusCode={StatusCode} ErrorCode={ErrorCode}",
                context.Request.Path, statusCode, errorCode);
        }
        else
        {
            _logger.LogWarning(exception,
                "Request error | Path={Path} StatusCode={StatusCode} ErrorCode={ErrorCode}",
                context.Request.Path, statusCode, errorCode);
        }

        if (context.Response.HasStarted)
        {
            _logger.LogWarning("Response already started — cannot write error response for {Path}", context.Request.Path);
            return;
        }

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var problem = new ApiProblemDetail
        {
            Title = title,
            Status = statusCode,
            Detail = SanitiseMessage(exception, context),
            ErrorCode = errorCode,
            Instance = context.Request.Path
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(problem, JsonOptions));
    }

    private static (int statusCode, string errorCode, string title) ClassifyException(Exception ex)
    {
        // Circuit breaker is open — the downstream service is known to be unavailable.
        // Return 503 immediately rather than letting the request attempt and timeout.
        if (ex is BrokenCircuitException or IsolatedCircuitException)
            return (StatusCodes.Status503ServiceUnavailable, "CIRCUIT_OPEN",
                "A downstream service is temporarily unavailable. Please try again shortly.");

        // HttpRequestException wraps errors from downstream HTTP services (Analytics, GetWet, GeoNames)
        if (ex is HttpRequestException httpEx)
        {
            var statusCode = (int?)httpEx.StatusCode;

            // Analytics domain outcomes — these are expected, not service failures
            if (statusCode == 404)
                return (StatusCodes.Status404NotFound, "IMAGERY_NOT_FOUND",
                    "No suitable satellite imagery found for this location. Try again after the next satellite pass.");

            if (statusCode == 422)
                return (StatusCodes.Status422UnprocessableEntity, "INSUFFICIENT_WATER",
                    "The selected location does not have enough water pixels to analyse. Ensure the pin is placed over open water.");

            // Rate limit from upstream service (e.g. Groq LLM quota exceeded)
            if (statusCode == 429)
                return (StatusCodes.Status429TooManyRequests, "UPSTREAM_RATE_LIMIT",
                    "The AI analysis service is temporarily rate-limited. Please wait a moment and try again.");

            // Authentication failure against upstream
            if (statusCode == 401 || statusCode == 403)
                return (StatusCodes.Status502BadGateway, "UPSTREAM_AUTH_ERROR",
                    "An upstream service authentication error occurred.");

            // Upstream service itself is unavailable
            if (statusCode == 503 || statusCode == 500)
                return (StatusCodes.Status502BadGateway, "UPSTREAM_SERVICE_ERROR",
                    "An upstream service is temporarily unavailable.");

            // Generic bad gateway for other HTTP errors
            return (StatusCodes.Status502BadGateway, "UPSTREAM_HTTP_ERROR",
                "An error was received from an upstream service.");
        }

        // Network-level timeouts
        if (ex is TaskCanceledException or TimeoutException)
            return (StatusCodes.Status504GatewayTimeout, "UPSTREAM_TIMEOUT",
                "The request to an upstream service timed out. Please try again.");

        // JSON deserialization failures (e.g. upstream returned unexpected payload)
        if (ex is JsonException)
            return (StatusCodes.Status502BadGateway, "UPSTREAM_PARSE_ERROR",
                "An unexpected response was received from an upstream service.");

        // MongoDB connectivity issues
        if (ex is MongoDB.Driver.MongoException)
            return (StatusCodes.Status503ServiceUnavailable, "DATABASE_ERROR",
                "A database error occurred. Please try again.");

        // Configuration errors — these should alert immediately (startup guard is better, but belt-and-braces)
        if (ex is InvalidOperationException && ex.Message.Contains("is not configured"))
            return (StatusCodes.Status500InternalServerError, "CONFIGURATION_ERROR",
                "A required service configuration is missing.");

        // Catch-all
        return (StatusCodes.Status500InternalServerError, "INTERNAL_ERROR",
            "An unexpected error occurred. Please try again later.");
    }

    /// <summary>
    /// Returns a safe detail message. In production, internal exception messages are hidden.
    /// </summary>
    private static string SanitiseMessage(Exception ex, HttpContext context)
    {
        var env = context.RequestServices.GetRequiredService<IWebHostEnvironment>();
        if (env.IsDevelopment())
            return ex.Message;

        // Surface the pre-classified title as the detail in production — never raw exception messages
        return ClassifyException(ex).title;
    }
}

/// <summary>
/// RFC 7807-style problem detail response, extended with an <c>errorCode</c>
/// field the UI can switch on to show user-friendly messages.
/// </summary>
public record ApiProblemDetail
{
    public string Title { get; init; } = string.Empty;
    public int Status { get; init; }
    public string Detail { get; init; } = string.Empty;

    /// <summary>
    /// Machine-readable error code for the UI to handle specific cases
    /// (e.g. "UPSTREAM_RATE_LIMIT" → show retry countdown).
    /// </summary>
    public string ErrorCode { get; init; } = string.Empty;
    public string Instance { get; init; } = string.Empty;
}