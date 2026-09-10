using System.ComponentModel.DataAnnotations;
using BugShot.Api.Attachments;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace BugShot.Api.Tests;

// limit w kontrakcie musi rownac sie kolumnie bo rozjazd wychodzi dopiero z bazy jako 500
public class ContractLimitsTests
{
    private static readonly IModel Model =
        new BugShotDbContext(new DbContextOptionsBuilder<BugShotDbContext>()
            .UseNpgsql("Host=localhost")
            .UseSnakeCaseNamingConvention()
            .Options).Model;

    private static int ColumnLength<TEntity>(string propertyName) =>
        Model.FindEntityType(typeof(TEntity))!.FindProperty(propertyName)!.GetMaxLength()
        ?? throw new InvalidOperationException($"{typeof(TEntity).Name}.{propertyName} nie ma limitu dlugosci.");

    private static int ParameterLength<TRequest>(string parameterName) =>
        typeof(TRequest)
            .GetConstructors()
            .Single()
            .GetParameters()
            .Single(p => p.Name == parameterName)
            .GetCustomAttributes(typeof(MaxLengthAttribute), inherit: false)
            .Cast<MaxLengthAttribute>()
            .Single()
            .Length;

    private static RegularExpressionAttribute ParameterPattern<TRequest>(string parameterName) =>
        typeof(TRequest)
            .GetConstructors()
            .Single()
            .GetParameters()
            .Single(p => p.Name == parameterName)
            .GetCustomAttributes(typeof(RegularExpressionAttribute), inherit: false)
            .Cast<RegularExpressionAttribute>()
            .Single();

    [Theory]
    [InlineData("Author")]
    [InlineData("Body")]
    public void KomentarzMaTakiSamLimitCoKolumna(string name)
    {
        Assert.Equal(ColumnLength<TicketComment>(name), ParameterLength<CreateTicketCommentRequest>(name));
    }

    [Fact]
    public void NazwaPlikuMaTakiSamLimitCoKolumna()
    {
        Assert.Equal(AttachmentLimits.MaxFileNameLength, ColumnLength<TicketAttachment>(nameof(TicketAttachment.FileName)));
    }

    [Theory]
    [InlineData("Author")]
    [InlineData("Body")]
    public void SamaSpacjaNiePrzechodziReguly(string name)
    {
        Assert.False(ParameterPattern<CreateTicketCommentRequest>(name).IsValid("   "));
    }

    [Theory]
    [InlineData("Author")]
    [InlineData("Body")]
    public void ZwyklaWartoscPrzechodziReguly(string name)
    {
        Assert.True(ParameterPattern<CreateTicketCommentRequest>(name).IsValid("tester"));
    }

    // DataAnnotations dopasowuje caly napis wiec bez (?s) kropka nie objelaby zlamania linii
    [Fact]
    public void WielolinijkowaTrescKomentarzaPrzechodziReguly()
    {
        Assert.True(ParameterPattern<CreateTicketCommentRequest>("Body").IsValid("Pierwsza linia\nDruga linia"));
    }
}
