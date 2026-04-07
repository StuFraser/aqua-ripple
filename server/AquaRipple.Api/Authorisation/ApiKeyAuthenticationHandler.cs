using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace AquaRipple.Api.Authentication;

public class ApiKeyAuthenticationHandler : AuthenticationHandler<ApiKeyAuthenticationSchemeOptions>
{
    private const string ApiKeyHeaderName = "X-API-Key";

    public ApiKeyAuthenticationHandler(
        IOptionsMonitor<ApiKeyAuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // Allow CORS preflight requests to pass through without authentication
        if (Request.Method == HttpMethods.Options)
            return Task.FromResult(AuthenticateResult.NoResult());

        if (!Request.Headers.TryGetValue(ApiKeyHeaderName, out var apiKeyHeaderValues))
        {
            // Return Fail (not NoResult) so the fallback RequireAuthenticatedUser policy
            // produces a 401 rather than silently passing the request as anonymous.
            return Task.FromResult(AuthenticateResult.Fail("Missing API key."));
        }

        var providedApiKey = apiKeyHeaderValues.ToString();
        var validApiKey = Context.RequestServices
            .GetRequiredService<IConfiguration>()["ApiKey:Value"];

        if (string.IsNullOrEmpty(validApiKey) || !providedApiKey.Equals(validApiKey))
        {
            Logger.LogWarning("Invalid API key presented from {RemoteIp}",
                Context.Connection.RemoteIpAddress);
            return Task.FromResult(AuthenticateResult.Fail("Invalid API key."));
        }

        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, "api-client") };
        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

public class ApiKeyAuthenticationSchemeOptions : AuthenticationSchemeOptions
{
}