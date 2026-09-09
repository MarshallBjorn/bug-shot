namespace BugShot.Api.Models;

public class UserRefreshToken : ICreatedAt
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public User User { get; set; } = null!;

    // w bazie lezy sam skrot bo token widzi tylko przegladarka
    public byte[] TokenHash { get; set; } = [];

    public DateTimeOffset ExpiresAt { get; set; }

    // wypelnione oznacza token zuzyty przez rotacje
    public DateTimeOffset? UsedAt { get; set; }

    // wypelnione oznacza token uniewazniony przed czasem
    public DateTimeOffset? RevokedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
