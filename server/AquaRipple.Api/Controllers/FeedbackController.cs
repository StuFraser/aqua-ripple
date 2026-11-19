using AquaRipple.Api.Models;
using AquaRipple.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AquaRipple.Api.Controllers;

[ApiController]
[Route("api/feedback")]
[EnableRateLimiting("feedback")]
public class FeedbackController(
    IFeedbackValidationService validationService,
    IGitHubDiscussionsService discussionsService,
    ILogger<FeedbackController> logger) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<FeedbackResponse>> Submit(
        [FromBody] FeedbackRequest request,
        CancellationToken cancellationToken)
    {
        var errors = validationService.Validate(request);
        if (errors.Count > 0)
            return BadRequest(new { error = string.Join(" ", errors) });

        // Bots often fill every form field; accept the request without sending
        // anything to GitHub so the behaviour gives them no useful signal.
        if (!string.IsNullOrWhiteSpace(request.Website))
        {
            logger.LogInformation("Feedback submission dropped because the honeypot was filled.");
            return Ok(new FeedbackResponse());
        }

        try
        {
            var discussionUrl = await discussionsService.CreateDiscussionAsync(
                request.Category, request.Message.Trim(), cancellationToken);
            return Ok(new FeedbackResponse { DiscussionUrl = discussionUrl });
        }
        catch (GitHubDiscussionsException ex)
        {
            logger.LogWarning(ex, "GitHub Discussions submission failed");
            return StatusCode(StatusCodes.Status502BadGateway,
                new { error = "Feedback could not be submitted right now. Please try again later." });
        }
    }
}
