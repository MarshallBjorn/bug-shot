namespace BugShot.Api.Contracts;

public record SanitizationRuleResponse(
    Guid Id,
    Guid? ProjectId,
    string Pattern,
    string Replacement,
    bool IsEnabled,
    DateTimeOffset CreatedAt);

public record TestSanitizationRuleResponse(string Result, int MatchCount);
