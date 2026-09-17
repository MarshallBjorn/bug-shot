using BugShot.Api.Contracts;
using BugShot.Api.Controllers;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

[Collection("PostgreSQL tests")]
public class ProjectPagesControllerTests
{
    private static BugShotDbContext NewContext()
    {
        var db = TestDatabase.OpenContext();
        db.Tickets.ExecuteDelete();

        return db;
    }

    // page nadaje kontroler przy przyjeciu wiec wstawiajac encje wprost ustawiamy go sami
    private static Ticket NewTicket(Guid projectId, string page, TicketStatus status) => new()
    {
        ProjectId = projectId,
        Description = $"zgloszenie z {page}",
        PageUrl = $"https://{page}",
        Page = page,
        UserAgent = "Mozilla/5.0",
        Status = status
    };

    private static async Task<(BugShotDbContext Db, Guid ProjectId)> SeedAsync()
    {
        var db = NewContext();
        var projectId = await db.Projects.Where(p => p.Key == "demo").Select(p => p.Id).SingleAsync();

        db.Tickets.AddRange(
            NewTicket(projectId, "acme.example/cart", TicketStatus.New),
            NewTicket(projectId, "acme.example/cart", TicketStatus.New),
            NewTicket(projectId, "acme.example/cart", TicketStatus.InProgress),
            NewTicket(projectId, "acme.example/cart", TicketStatus.Resolved),
            NewTicket(projectId, "acme.example/checkout", TicketStatus.Rejected),
            NewTicket(projectId, "acme.example/checkout", TicketStatus.New));

        await db.SaveChangesAsync();

        return (db, projectId);
    }

    private static ProjectPagesResponse Payload(ActionResult<ProjectPagesResponse> result) =>
        Assert.IsType<ProjectPagesResponse>(Assert.IsType<OkObjectResult>(result.Result).Value);

    [Fact]
    public async Task StronyWrcajaZLicznikamiPerStatus()
    {
        var (db, projectId) = await SeedAsync();
        using var _ = db;

        var controller = new ProjectPagesController(db);

        var pages = Payload(await controller.GetList(projectId, CancellationToken.None));

        var cart = Assert.Single(pages.Items, p => p.Page == "acme.example/cart");

        Assert.Equal(4, cart.Total);
        Assert.Equal(2, cart.New);
        Assert.Equal(1, cart.InProgress);
        Assert.Equal(1, cart.Resolved);
        Assert.Equal(0, cart.Rejected);

        var checkout = Assert.Single(pages.Items, p => p.Page == "acme.example/checkout");

        Assert.Equal(2, checkout.Total);
        Assert.Equal(1, checkout.New);
        Assert.Equal(1, checkout.Rejected);
    }

    [Fact]
    public async Task KolejnoscIdziePoLiczbieZgloszen()
    {
        var (db, projectId) = await SeedAsync();
        using var _ = db;

        var controller = new ProjectPagesController(db);

        var pages = Payload(await controller.GetList(projectId, CancellationToken.None));

        Assert.Equal(
            ["acme.example/cart", "acme.example/checkout"],
            pages.Items.Select(p => p.Page));
    }

    [Fact]
    public async Task SkasowaneZgloszenieWypadaZeStron()
    {
        var (db, projectId) = await SeedAsync();
        using var _ = db;

        // kasowanie zeruje adres wiec tombstone nie ma czym trafic do grupy
        var tombstone = await db.Tickets.FirstAsync(t => t.Page == "acme.example/checkout");
        tombstone.Status = TicketStatus.Deleted;
        tombstone.Page = string.Empty;
        await db.SaveChangesAsync();

        var controller = new ProjectPagesController(db);

        var pages = Payload(await controller.GetList(projectId, CancellationToken.None));

        var checkout = Assert.Single(pages.Items, p => p.Page == "acme.example/checkout");

        Assert.Equal(1, checkout.Total);
        Assert.DoesNotContain(string.Empty, pages.Items.Select(p => p.Page));
    }

    [Fact]
    public async Task LimitPrzycinaListe()
    {
        var (db, projectId) = await SeedAsync();
        using var _ = db;

        var controller = new ProjectPagesController(db);

        var pages = Payload(await controller.GetList(projectId, CancellationToken.None, limit: 1));

        Assert.Single(pages.Items);
        Assert.Equal("acme.example/cart", pages.Items[0].Page);
    }

    [Fact]
    public async Task NieznanyProjektDaje404()
    {
        var (db, _) = await SeedAsync();
        using var __ = db;

        var controller = new ProjectPagesController(db);

        var result = await controller.GetList(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }
}
