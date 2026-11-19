using AquaRipple.Api.Models;

namespace AquaRipple.Api.Services;

public interface IFeedbackValidationService
{
    List<string> Validate(FeedbackRequest request);
}

public class FeedbackValidationService : IFeedbackValidationService
{
    private const int MaxMessageLength = 4_000;

    public List<string> Validate(FeedbackRequest request)
    {
        var errors = new List<string>();

        if (!FeedbackCategories.Allowed.Contains(request.Category))
            errors.Add($"category must be one of: {string.Join(", ", FeedbackCategories.Allowed)}.");

        if (string.IsNullOrWhiteSpace(request.Message))
            errors.Add("message is required.");
        else if (request.Message.Length > MaxMessageLength)
            errors.Add($"message must be {MaxMessageLength} characters or fewer.");

        return errors;
    }
}
