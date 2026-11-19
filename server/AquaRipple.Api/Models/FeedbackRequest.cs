namespace AquaRipple.Api.Models;

public static class FeedbackCategories
{
    // These are GitHub's standard discussion categories, so enabling Discussions
    // on a new repository is sufficient to use the feedback form.
    public static readonly string[] Allowed = ["Ideas", "General"];
}

public class FeedbackRequest
{
    public string Category { get; set; } = "";
    public string Message { get; set; } = "";

    /// <summary>Honeypot field — real users never see this field.</summary>
    public string? Website { get; set; }
}

public class FeedbackResponse
{
    public bool Success { get; set; } = true;
    public string DiscussionUrl { get; set; } = "";
}
