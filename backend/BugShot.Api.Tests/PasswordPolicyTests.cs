using System.ComponentModel.DataAnnotations;
using System.Text;
using BugShot.Api.Contracts;
using BugShot.Api.Security;

namespace BugShot.Api.Tests;

public class PasswordPolicyTests
{
    private static ValidationResult? Validate(string? password)
    {
        var context = new ValidationContext(new object()) { MemberName = "Password" };

        return new PasswordPolicyAttribute().GetValidationResult(password, context);
    }

    [Fact]
    public void PoprawneHasloPrzechodzi()
    {
        Assert.Null(Validate("wystarczajaco-dlugie-haslo"));
    }

    [Fact]
    public void ZaKrotkieHasloJestOdrzucane()
    {
        var result = Validate(new string('a', PasswordHasher.MinPasswordLength - 1));

        Assert.NotNull(result);
        Assert.Contains("Password", result.MemberNames);
    }

    [Fact]
    public void HasloDokladnieNaMinimumPrzechodzi()
    {
        Assert.Null(Validate(new string('a', PasswordHasher.MinPasswordLength)));
    }

    [Fact]
    public void HasloPonad72BajtyJestOdrzucane()
    {
        Assert.NotNull(Validate(new string('a', PasswordHasher.MaxPasswordBytes + 1)));
    }

    [Fact]
    public void HasloDokladnieNaGranicyPrzechodzi()
    {
        Assert.Null(Validate(new string('a', PasswordHasher.MaxPasswordBytes)));
    }

    // bcrypt liczy bajty a nie znaki wiec haslo z polskimi literami konczy sie wczesniej niz wyglada
    [Fact]
    public void LimitLiczySieWBajtachANieWZnakach()
    {
        var password = new string('ą', 40);

        Assert.Equal(40, password.Length);
        Assert.Equal(80, Encoding.UTF8.GetByteCount(password));
        Assert.NotNull(Validate(password));
    }

    [Fact]
    public void BrakHaslaJestOdrzucany()
    {
        Assert.NotNull(Validate(null));
    }

    // MVC waliduje rekord po parametrach konstruktora a ten sam atrybut na property konczy sie 500
    [Theory]
    [InlineData(typeof(CreateUserRequest), "Password")]
    [InlineData(typeof(CreateUserRequest), "Email")]
    [InlineData(typeof(ResetPasswordRequest), "Password")]
    [InlineData(typeof(LoginRequest), "Email")]
    [InlineData(typeof(LoginRequest), "Password")]
    public void ParametrKonstruktoraNiesieWalidacje(Type contract, string name)
    {
        var parameter = contract
            .GetConstructors()
            .Single()
            .GetParameters()
            .Single(p => p.Name == name);

        Assert.NotEmpty(parameter.GetCustomAttributes(typeof(ValidationAttribute), inherit: false));
    }

    [Theory]
    [InlineData(typeof(CreateUserRequest), "Password")]
    [InlineData(typeof(CreateUserRequest), "Email")]
    [InlineData(typeof(ResetPasswordRequest), "Password")]
    [InlineData(typeof(LoginRequest), "Email")]
    [InlineData(typeof(LoginRequest), "Password")]
    public void PropertyNieNiesieWalidacji(Type contract, string name)
    {
        var property = contract.GetProperty(name)!;

        Assert.Empty(property.GetCustomAttributes(typeof(ValidationAttribute), inherit: false));
    }

    // haslo do logowania nie ma polityki bo kazda niezgodnosc konczy sie tym samym 401
    [Fact]
    public void LogowanieNieWymuszaPolitykiHasla()
    {
        var parameter = typeof(LoginRequest)
            .GetConstructors()
            .Single()
            .GetParameters()
            .Single(p => p.Name == "Password");

        Assert.Empty(parameter.GetCustomAttributes(typeof(PasswordPolicyAttribute), inherit: false));
    }

    [Fact]
    public void HashUzywaBcryptaZKosztem12()
    {
        var hash = PasswordHasher.Hash("wystarczajaco-dlugie-haslo");

        Assert.StartsWith("$2", hash);
        Assert.Contains("$12$", hash);
    }

    [Fact]
    public void HashSprawdzaSieTylkoZeSwoimHaslem()
    {
        var hash = PasswordHasher.Hash("wystarczajaco-dlugie-haslo");

        Assert.True(PasswordHasher.Verify("wystarczajaco-dlugie-haslo", hash));
        Assert.False(PasswordHasher.Verify("zupelnie-inne-haslo", hash));
    }

    // ta sama sol dwa razy dalaby ten sam hash i ujawniala ze dwa konta maja to samo haslo
    [Fact]
    public void DwaHasheTegoSamegoHaslaSaRozne()
    {
        Assert.NotEqual(
            PasswordHasher.Hash("wystarczajaco-dlugie-haslo"),
            PasswordHasher.Hash("wystarczajaco-dlugie-haslo"));
    }
}
