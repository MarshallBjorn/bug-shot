using System.Text;
using BugShot.Api.Contracts;
using BugShot.Api.Controllers;
using BugShot.Api.Data;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Tests;

public class UploadTokenTests
{
    private static BugShotDbContext NewContext()
    {
        var db = new BugShotDbContext(new DbContextOptionsBuilder<BugShotDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

        db.Database.EnsureCreated();
        return db;
    }

    private static CreateTicketRequest Request() => new()
    {
        ProjectKey = "demo",
        Description = "Koszyk gubi produkty",
        PageUrl = "https://acme.example/cart",
        UserAgent = "Mozilla/5.0"
    };

    private static async Task<CreatedTicketResponse> CreateTicket(BugShotDbContext db)
    {
        var result = await new TicketsController(db).Create(Request(), CancellationToken.None);
        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        return Assert.IsType<CreatedTicketResponse>(created.Value);
    }

    [Fact]
    public async Task ZgloszenieDostajeTokenWaznyPrzezKwadrans()
    {
        using var db = NewContext();

        var payload = await CreateTicket(db);

        Assert.False(string.IsNullOrWhiteSpace(payload.UploadToken));

        var token = await db.TicketUploadTokens.SingleAsync();
        Assert.Equal(payload.Id, token.TicketId);
        Assert.Null(token.UsedAt);
        Assert.Equal(payload.UploadTokenExpiresAt, token.ExpiresAt);

        var lifetime = token.ExpiresAt - token.CreatedAt;
        Assert.InRange(lifetime, UploadToken.Lifetime - TimeSpan.FromSeconds(5), UploadToken.Lifetime);
    }

    [Fact]
    public async Task BazaTrzymaSkrotAnieSamToken()
    {
        using var db = NewContext();

        var payload = await CreateTicket(db);

        var token = await db.TicketUploadTokens.SingleAsync();
        Assert.Equal(UploadToken.Hash(payload.UploadToken), token.TokenHash);
        Assert.NotEqual(Encoding.UTF8.GetBytes(payload.UploadToken), token.TokenHash);
    }

    [Fact]
    public async Task KazdeZgloszenieDostajeWlasnyToken()
    {
        using var db = NewContext();

        var first = await CreateTicket(db);
        var second = await CreateTicket(db);

        Assert.NotEqual(first.UploadToken, second.UploadToken);
        Assert.Equal(2, await db.TicketUploadTokens.CountAsync());
    }
}
