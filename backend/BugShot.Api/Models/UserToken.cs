namespace BugShot.Api.Models;

// jednorazowy link z maila ktorym konto samo ustawia haslo
public class UserToken : ICreatedAt
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public User User { get; set; } = null!;

    public UserTokenPurpose Purpose { get; set; }

    // w bazie lezy sam skrot bo token zna tylko odbiorca maila
    public byte[] TokenHash { get; set; } = [];

    public DateTimeOffset ExpiresAt { get; set; }

    public DateTimeOffset? UsedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
