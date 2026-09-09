namespace BugShot.Api.Models;

public class User : ICreatedAt
{
    public Guid Id { get; set; }

    public string Email { get; set; } = string.Empty;

    // w bazie lezy wylacznie hash bcrypt razem z sola i kosztem
    public string PasswordHash { get; set; } = string.Empty;

    public bool IsAdmin { get; set; }

    // wylaczone konto zostaje w bazie bo jest podpiete pod historie zmian
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<UserRefreshToken> RefreshTokens { get; set; } = [];
}
