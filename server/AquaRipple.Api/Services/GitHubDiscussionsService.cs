using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AquaRipple.Api.Services;

public interface IGitHubDiscussionsService
{
    Task<string> CreateDiscussionAsync(string category, string message, CancellationToken cancellationToken);
}

public class GitHubDiscussionsException(string message) : Exception(message);

/// <summary>Creates public feedback discussions without exposing a GitHub token to the browser.</summary>
public class GitHubDiscussionsService(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    ILogger<GitHubDiscussionsService> logger) : IGitHubDiscussionsService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly SemaphoreSlim _metadataLock = new(1, 1);
    private string? _repositoryId;
    private Dictionary<string, string>? _categoryIds;

    public async Task<string> CreateDiscussionAsync(string category, string message, CancellationToken cancellationToken)
    {
        var token = configuration["GitHub:Token"];
        if (string.IsNullOrWhiteSpace(token))
            throw new GitHubDiscussionsException("GitHub Discussions is not configured.");

        var client = httpClientFactory.CreateClient("GitHub");
        await EnsureMetadataAsync(client, token, cancellationToken);

        if (!_categoryIds!.TryGetValue(category, out var categoryId))
            throw new GitHubDiscussionsException($"Discussion category '{category}' was not found.");

        const string mutation = """
            mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
              createDiscussion(input: {
                repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body
              }) { discussion { url } }
            }
            """;

        var variables = new
        {
            repositoryId = _repositoryId,
            categoryId,
            title = $"AquaRipple feedback — {DateTime.UtcNow:yyyy-MM-dd HH:mm} UTC",
            body = message,
        };
        var result = await ExecuteAsync<CreateDiscussionResponse>(client, token, mutation, variables, cancellationToken);
        var url = result?.CreateDiscussion?.Discussion?.Url;
        return !string.IsNullOrWhiteSpace(url)
            ? url
            : throw new GitHubDiscussionsException("GitHub did not create a discussion.");
    }

    private async Task EnsureMetadataAsync(HttpClient client, string token, CancellationToken cancellationToken)
    {
        if (_repositoryId is not null && _categoryIds is not null) return;

        await _metadataLock.WaitAsync(cancellationToken);
        try
        {
            if (_repositoryId is not null && _categoryIds is not null) return;

            var owner = configuration["GitHub:RepositoryOwner"];
            var name = configuration["GitHub:RepositoryName"];
            if (string.IsNullOrWhiteSpace(owner) || string.IsNullOrWhiteSpace(name))
                throw new GitHubDiscussionsException("GitHub repository configuration is missing.");

            const string query = """
                query($owner: String!, $name: String!) {
                  repository(owner: $owner, name: $name) {
                    id
                    discussionCategories(first: 25) { nodes { id name } }
                  }
                }
                """;
            var result = await ExecuteAsync<RepositoryMetadataResponse>(
                client, token, query, new { owner, name }, cancellationToken);
            var repository = result?.Repository
                ?? throw new GitHubDiscussionsException("GitHub repository was not found.");

            _repositoryId = repository.Id;
            _categoryIds = repository.DiscussionCategories.Nodes
                .ToDictionary(category => category.Name, category => category.Id);
        }
        finally
        {
            _metadataLock.Release();
        }
    }

    private async Task<T?> ExecuteAsync<T>(
        HttpClient client, string token, string query, object variables, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "graphql")
        {
            Content = JsonContent.Create(new { query, variables }, options: JsonOptions),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(request, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "GitHub GraphQL request failed");
            throw new GitHubDiscussionsException("GitHub could not be reached.");
        }

        var body = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("GitHub GraphQL returned HTTP {StatusCode}: {Body}", (int)response.StatusCode, body);
            throw new GitHubDiscussionsException("GitHub rejected the feedback request.");
        }

        var envelope = JsonSerializer.Deserialize<GraphQlEnvelope<T>>(body, JsonOptions);
        if (envelope?.Errors is { Count: > 0 })
        {
            logger.LogWarning("GitHub GraphQL errors: {Errors}", string.Join("; ", envelope.Errors.Select(e => e.Message)));
            throw new GitHubDiscussionsException("GitHub could not create the feedback discussion.");
        }

        return envelope is null ? default : envelope.Data;
    }

    private sealed class GraphQlEnvelope<T> { public T? Data { get; set; } public List<GraphQlError>? Errors { get; set; } }
    private sealed class GraphQlError { public string Message { get; set; } = ""; }
    private sealed class RepositoryMetadataResponse { public RepositoryNode? Repository { get; set; } }
    private sealed class RepositoryNode { public string Id { get; set; } = ""; public DiscussionCategoriesConnection DiscussionCategories { get; set; } = new(); }
    private sealed class DiscussionCategoriesConnection { public List<CategoryNode> Nodes { get; set; } = []; }
    private sealed class CategoryNode { public string Id { get; set; } = ""; public string Name { get; set; } = ""; }
    private sealed class CreateDiscussionResponse { public CreateDiscussionPayload? CreateDiscussion { get; set; } }
    private sealed class CreateDiscussionPayload { public DiscussionNode? Discussion { get; set; } }
    private sealed class DiscussionNode { public string Url { get; set; } = ""; }
}
