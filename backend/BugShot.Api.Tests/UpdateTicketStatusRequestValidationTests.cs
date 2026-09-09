using System.ComponentModel.DataAnnotations;
using BugShot.Api.Contracts;

namespace BugShot.Api.Tests;

// MVC waliduje rekord po parametrach konstruktora i wywala 500 gdy ten sam atrybut
// siedzi na property. Testy pilnuja zeby atrybuty zostaly przy parametrach
public class UpdateTicketStatusRequestValidationTests
{
    [Theory]
    [InlineData("Status")]
    [InlineData("ChangedBy")]
    public void ParametrKonstruktoraNiesieWalidacje(string name)
    {
        var parameter = typeof(UpdateTicketStatusRequest)
            .GetConstructors()
            .Single()
            .GetParameters()
            .Single(p => p.Name == name);

        Assert.NotEmpty(parameter.GetCustomAttributes(typeof(ValidationAttribute), inherit: false));
    }

    [Theory]
    [InlineData("Status")]
    [InlineData("ChangedBy")]
    public void PropertyNieNiesieWalidacji(string name)
    {
        var property = typeof(UpdateTicketStatusRequest).GetProperty(name)!;

        Assert.Empty(property.GetCustomAttributes(typeof(ValidationAttribute), inherit: false));
    }
}
