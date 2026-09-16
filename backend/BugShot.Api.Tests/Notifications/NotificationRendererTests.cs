using BugShot.Api.Models;
using BugShot.Api.Notifications;

namespace BugShot.Api.Tests.Notifications;

public sealed class NotificationRendererTests
{
    private readonly NotificationRenderer _renderer = new();

    [Fact]
    public void Render_TicketCreated_ResolvesProjectAndTicketTokens()
    {
        var project = CreateProject();
        var ticket = CreateTicket();

        var result = _renderer.Render(
            "Ticket {{ticket.id}} in {{project.name}} ({{project.key}}): {{ticket.description}}",
            NotificationEventType.TicketCreated,
            project,
            ticket);

        Assert.Empty(result.MissingTokens);
        Assert.Equal(
            $"Ticket {ticket.Id} in Test Project (TST): App crashed",
            result.Content);
    }

    [Fact]
    public void Render_UnknownToken_ReplacesWithEmptyAndTracksToken()
    {
        var project = CreateProject();
        var ticket = CreateTicket();

        var result = _renderer.Render(
            "Hello {{unknown.token}} {{project.key}}",
            NotificationEventType.TicketCreated,
            project,
            ticket);

        Assert.Equal("Hello  TST", result.Content);
        var token = Assert.Single(result.MissingTokens);
        Assert.Equal("unknown.token", token);
    }

    [Fact]
    public void Render_CommentAdded_ResolvesCommentTokens()
    {
        var project = CreateProject();
        var ticket = CreateTicket();
        var comment = new TicketComment
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            Author = "Radek",
            Body = "Fix is ready"
        };

        var result = _renderer.Render(
            "{{comment.author}}: {{comment.body}}",
            NotificationEventType.CommentAdded,
            project,
            ticket,
            comment: comment);

        Assert.Empty(result.MissingTokens);
        Assert.Equal("Radek: Fix is ready", result.Content);
    }

    [Fact]
    public void Render_CommentToken_ForWrongEvent_IsMissing()
    {
        var project = CreateProject();
        var ticket = CreateTicket();

        var result = _renderer.Render(
            "Author: {{comment.author}}",
            NotificationEventType.TicketCreated,
            project,
            ticket);

        Assert.Equal("Author: ", result.Content);

        var token = Assert.Single(result.MissingTokens);
        Assert.Equal("comment.author", token);
    }

    [Fact]
    public void Render_StatusChanged_ResolvesStatusTokens()
    {
        var project = CreateProject();
        var ticket = CreateTicket();

        var statusChange = new TicketStatusChange
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            FromStatus = TicketStatus.New,
            ToStatus = TicketStatus.InProgress,
            ChangedBy = "Admin"
        };

        var result = _renderer.Render(
            "{{status.from}} -> {{status.to}} by {{status.changedBy}}",
            NotificationEventType.StatusChanged,
            project,
            ticket,
            statusChange: statusChange);

        Assert.Empty(result.MissingTokens);
        Assert.Equal("New -> InProgress by Admin", result.Content);
    }

    [Fact]
    public void Render_NullKnownValue_IsEmptyButNotMissing()
    {
        var project = CreateProject();
        var ticket = CreateTicket();
        ticket.ReportedAt = null;

        var result = _renderer.Render(
            "Reported: {{ticket.reportedAt}}",
            NotificationEventType.TicketCreated,
            project,
            ticket);

        Assert.Equal("Reported: ", result.Content);
        Assert.Empty(result.MissingTokens);
    }

    [Fact]
    public void Render_RepeatedUnknownToken_IsTrackedOnce()
    {
        var project = CreateProject();
        var ticket = CreateTicket();

        var result = _renderer.Render(
            "{{unknown.token}} {{unknown.token}}",
            NotificationEventType.TicketCreated,
            project,
            ticket);

        Assert.Equal(" ", result.Content);
        var token = Assert.Single(result.MissingTokens);
        Assert.Equal("unknown.token", token);
    }

    private static Project CreateProject()
        => new()
        {
            Id = Guid.NewGuid(),
            Name = "Test Project",
            Key = "TST"
        };

    private static Ticket CreateTicket()
        => new()
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            Description = "App crashed",
            PageUrl = "https://example.com",
            Status = TicketStatus.New,
            ReportedAt = new DateTimeOffset(
                2026,
                9,
                16,
                10,
                0,
                0,
                TimeSpan.Zero)
        };
}
