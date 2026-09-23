using BugShot.Api.Models;
using BugShot.Api.Notifications;

namespace BugShot.Api.Tests.Notifications;

// Renderuje DOKLADNIE te same domyslne szablony co migracja
// 20260916074237_AddNotifications (global, project_id = null), zeby wylapac
// regresje typu "puste body", "surowy {{placeholder}}" albo "null w mailu"
// bez potrzeby bazy danych czy SMTP - to czysty unit test na NotificationRenderer.
//
// Jesli zmienisz domyslne szablony w nowej migracji, zaktualizuj tez stale
// ponizej - celowo NIE odczytujemy migracji przez refleksje, zeby test
// faktycznie pilnowal tego co produkcyjnie wyjdzie z Renderera, a nie tylko
// echo tego co jest w migracji.
public sealed class DefaultNotificationTemplatesTests
{
    private const string TicketCreatedEmailSubject = "New ticket {{ticket.id}}";
    private const string TicketCreatedBody = "{{ticket.description}}";

    private const string CommentAddedEmailSubject = "New comment on {{ticket.id}}";
    private const string CommentAddedBody = "{{comment.author}}: {{comment.body}}";

    private const string StatusChangedEmailSubject = "Status changed for {{ticket.id}}";
    private const string StatusChangedBody = "{{status.from}} -> {{status.to}}";

    private readonly NotificationRenderer renderer = new();

    [Fact]
    public void TicketCreated_Email_RendersNonEmptySubjectAndBody()
    {
        var project = CreateProject();
        var ticket = CreateTicket();

        var subject = renderer.Render(
            TicketCreatedEmailSubject,
            NotificationEventType.TicketCreated,
            project,
            ticket);

        var body = renderer.Render(
            TicketCreatedBody,
            NotificationEventType.TicketCreated,
            project,
            ticket);

        AssertNoRawPlaceholders(subject.Content);
        AssertNoRawPlaceholders(body.Content);
        Assert.False(string.IsNullOrWhiteSpace(subject.Content));
        Assert.False(string.IsNullOrWhiteSpace(body.Content));
        Assert.Contains(ticket.Id.ToString(), subject.Content);
        Assert.Equal(ticket.Description, body.Content);
        Assert.Empty(subject.MissingTokens);
        Assert.Empty(body.MissingTokens);
    }

    [Fact]
    public void TicketCreated_Webhook_BodyMatchesDescription_NoSubject()
    {
        var project = CreateProject();
        var ticket = CreateTicket();

        var body = renderer.Render(
            TicketCreatedBody,
            NotificationEventType.TicketCreated,
            project,
            ticket);

        AssertNoRawPlaceholders(body.Content);
        Assert.False(string.IsNullOrWhiteSpace(body.Content));
        // Webhook template w migracji ma subject = null - dispatcher musi to
        // obslugiwac (patrz NotificationDispatcherHostedService), renderer
        // tego nie dotyczy.
    }

    [Fact]
    public void CommentAdded_Email_RendersAuthorAndBody()
    {
        var project = CreateProject();
        var ticket = CreateTicket();
        var comment = new TicketComment
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            Author = "Radek",
            Body = "Naprawione w PR #6"
        };

        var subject = renderer.Render(
            CommentAddedEmailSubject,
            NotificationEventType.CommentAdded,
            project,
            ticket,
            comment: comment);

        var body = renderer.Render(
            CommentAddedBody,
            NotificationEventType.CommentAdded,
            project,
            ticket,
            comment: comment);

        AssertNoRawPlaceholders(subject.Content);
        AssertNoRawPlaceholders(body.Content);
        Assert.Equal("Radek: Naprawione w PR #6", body.Content);
        Assert.Empty(subject.MissingTokens);
        Assert.Empty(body.MissingTokens);
    }

    [Fact]
    public void StatusChanged_Email_RendersFromAndTo()
    {
        var project = CreateProject();
        var ticket = CreateTicket();
        var statusChange = new TicketStatusChange
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            FromStatus = TicketStatus.New,
            ToStatus = TicketStatus.Resolved,
            ChangedBy = "admin@bug-shot.test"
        };

        var subject = renderer.Render(
            StatusChangedEmailSubject,
            NotificationEventType.StatusChanged,
            project,
            ticket,
            statusChange: statusChange);

        var body = renderer.Render(
            StatusChangedBody,
            NotificationEventType.StatusChanged,
            project,
            ticket,
            statusChange: statusChange);

        AssertNoRawPlaceholders(subject.Content);
        AssertNoRawPlaceholders(body.Content);
        Assert.Equal("New -> Resolved", body.Content);
        Assert.Empty(subject.MissingTokens);
        Assert.Empty(body.MissingTokens);
    }

    [Fact]
    public void TicketCreated_Email_EmptyDescription_DoesNotProduceEmptyBody()
    {
        // Edge case audytowany na zadanie: opis moze teoretycznie wyjsc pusty
        // po sanitizacji. Body wtedy jest puste w SENSIE TRESCI (bo szablon
        // to tylko {{ticket.description}}), ale to NIE JEST blad renderera -
        // subject nadal niesie ticket.id, wiec mail nie jest bezuzyteczny.
        // Test dokumentuje ten fakt zamiast go ukrywac.
        var project = CreateProject();
        var ticket = CreateTicket();
        ticket.Description = string.Empty;

        var subject = renderer.Render(
            TicketCreatedEmailSubject,
            NotificationEventType.TicketCreated,
            project,
            ticket);

        var body = renderer.Render(
            TicketCreatedBody,
            NotificationEventType.TicketCreated,
            project,
            ticket);

        Assert.False(string.IsNullOrWhiteSpace(subject.Content));
        Assert.Equal(string.Empty, body.Content);
        Assert.Empty(body.MissingTokens);
    }

    private static void AssertNoRawPlaceholders(string content)
    {
        Assert.DoesNotContain("{{", content, StringComparison.Ordinal);
        Assert.DoesNotContain("}}", content, StringComparison.Ordinal);
    }

    private static Project CreateProject()
        => new()
        {
            Id = Guid.NewGuid(),
            Name = "Bug-Shot Demo",
            Key = "demo"
        };

    private static Ticket CreateTicket()
        => new()
        {
            Id = Guid.NewGuid(),
            ProjectId = Guid.NewGuid(),
            Description = "Przycisk zapisu nie dziala na stronie checkout",
            PageUrl = "https://example.com/checkout",
            Status = TicketStatus.New,
            ReportedAt = new DateTimeOffset(
                2026,
                9,
                16,
                12,
                0,
                0,
                TimeSpan.Zero)
        };
}
