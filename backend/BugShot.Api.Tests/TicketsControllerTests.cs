using BugShot.Api.Contracts;
using BugShot.Api.Controllers;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

public class TicketsControllerTests
{
    private static BugShotDbContext NewContext()
    {
        var db = new BugShotDbContext(new DbContextOptionsBuilder<BugShotDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

        // InMemory wstawia dane z HasData dopiero po tym wywolaniu
        db.Database.EnsureCreated();
        return db;
    }

    private static CreateTicketRequest Request(string projectKey) => new()
    {
        ProjectKey = projectKey,
        Description = "Koszyk gubi produkty",
        PageUrl = "https://acme.example/cart",
        UserAgent = "Mozilla/5.0"
    };

    [Fact]
    public async Task ZgloszenieZnanegoProjektuJestZapisywane()
    {
        using var db = NewContext();
        var project = await db.Projects.SingleAsync(p => p.Key == "demo");
        var controller = new TicketsController(db);

        var result = await controller.Create(Request("demo"), CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var payload = Assert.IsType<CreatedTicketResponse>(created.Value);

        var ticket = await db.Tickets.SingleAsync();
        Assert.Equal(payload.Id, ticket.Id);
        Assert.Equal(project.Id, ticket.ProjectId);
        Assert.Equal(TicketStatus.New, ticket.Status);
    }

    [Fact]
    public async Task ZapisUstawiaZnacznikiCzasu()
    {
        using var db = NewContext();
        var controller = new TicketsController(db);

        await controller.Create(Request("demo"), CancellationToken.None);

        var ticket = await db.Tickets.SingleAsync();
        Assert.NotEqual(default, ticket.CreatedAt);
        Assert.Equal(ticket.CreatedAt, ticket.UpdatedAt);
    }

    [Fact]
    public async Task NieznanyKluczProjektuJestOdrzucany()
    {
        using var db = NewContext();
        var controller = new TicketsController(db);

        var result = await controller.Create(Request("nie-istnieje"), CancellationToken.None);

        Assert.IsType<ObjectResult>(result.Result);
        Assert.False(controller.ModelState.IsValid);
        Assert.Empty(db.Tickets);
    }

    [Fact]
    public async Task SzczegolyNieistniejacegoZgloszeniaDaja404()
    {
        using var db = NewContext();
        var controller = new TicketsController(db);

        var result = await controller.GetById(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<NotFoundResult>(result.Result);
    }
}
