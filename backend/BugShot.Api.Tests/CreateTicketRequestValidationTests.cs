using System.ComponentModel.DataAnnotations;
using BugShot.Api.Contracts;

namespace BugShot.Api.Tests;

public class CreateTicketRequestValidationTests
{
    private static List<ValidationResult> Validate(CreateTicketRequest request)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(request, new ValidationContext(request), results, validateAllProperties: true);
        return results;
    }

    private static CreateTicketRequest Valid() => new()
    {
        ProjectKey = "demo",
        Description = "Koszyk gubi produkty",
        PageUrl = "https://acme.example/cart",
        UserAgent = "Mozilla/5.0"
    };

    [Fact]
    public void PoprawneZgloszeniePrzechodziWalidacje()
    {
        Assert.Empty(Validate(Valid()));
    }

    [Fact]
    public void PustyOpisJestOdrzucany()
    {
        var request = Valid();
        request.Description = string.Empty;

        Assert.Contains(Validate(request), r => r.MemberNames.Contains(nameof(request.Description)));
    }

    [Fact]
    public void OpisDluzszyNizLimitWidgetuJestOdrzucany()
    {
        var request = Valid();
        request.Description = new string('a', 1201);

        Assert.Contains(Validate(request), r => r.MemberNames.Contains(nameof(request.Description)));
    }

    [Fact]
    public void NiepoprawnyAdresStronyJestOdrzucany()
    {
        var request = Valid();
        request.PageUrl = "to nie jest adres";

        Assert.Contains(Validate(request), r => r.MemberNames.Contains(nameof(request.PageUrl)));
    }

    [Fact]
    public void BrakKluczaProjektuJestOdrzucany()
    {
        var request = Valid();
        request.ProjectKey = string.Empty;

        Assert.Contains(Validate(request), r => r.MemberNames.Contains(nameof(request.ProjectKey)));
    }
}
