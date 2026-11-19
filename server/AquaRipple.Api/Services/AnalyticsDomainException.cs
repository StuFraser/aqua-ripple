namespace AquaRipple.Api.Services;

/// <summary>
/// A safe, expected domain outcome returned by the analytics service.
/// Its detail is intentionally suitable for presentation to the user.
/// </summary>
public sealed class AnalyticsDomainException : Exception
{
    public int StatusCode { get; }

    public AnalyticsDomainException(int statusCode, string detail)
        : base(detail)
    {
        StatusCode = statusCode;
    }
}
