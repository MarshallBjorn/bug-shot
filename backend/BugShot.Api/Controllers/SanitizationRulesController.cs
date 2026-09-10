using System.Net.Mime;
using BugShot.Api.Contracts;
using BugShot.Api.Data;
using BugShot.Api.Models;
using BugShot.Api.Sanitization;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BugShot.Api.Controllers;

[ApiController]
[Route("api/v1/sanitization-rules")]
[EnableCors(CorsPolicies.Dashboard)]
[Authorize(Roles = AccessTokenIssuer.AdminRole)]
[Produces(MediaTypeNames.Application.Json)]
public class SanitizationRulesController(BugShotDbContext db) : ControllerBase
{
    /// <summary>Zwraca reguly sanityzacji.</summary>
    /// <remarks>
    /// Tylko dla administratora. Bez projectId zwraca wszystkie reguly, z projectId dolicza tez globalne.
    /// </remarks>
    /// <param name="cancellationToken">Token anulowania zadania.</param>
    /// <param name="projectId">Ogranicza liste do regul tego projektu i regul globalnych.</param>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<SanitizationRuleResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<SanitizationRuleResponse>>> GetList(
        CancellationToken cancellationToken,
        [FromQuery] Guid? projectId = null)
    {
        var query = db.SanitizationRules.AsNoTracking().AsQueryable();

        if (projectId is not null)
        {
            query = query.Where(r => r.ProjectId == null || r.ProjectId == projectId);
        }

        var rules = await query
            .OrderBy(r => r.CreatedAt)
            .Select(r => new SanitizationRuleResponse(
                r.Id, r.ProjectId, r.Pattern, r.Replacement, r.IsEnabled, r.CreatedAt))
            .ToListAsync(cancellationToken);

        return Ok(rules);
    }

    /// <summary>Zaklada regule sanityzacji.</summary>
    /// <remarks>Tylko dla administratora. Puste projectId oznacza regule globalna.</remarks>
    [HttpPost]
    [ProducesResponseType<SanitizationRuleResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SanitizationRuleResponse>> Create(
        CreateSanitizationRuleRequest request,
        CancellationToken cancellationToken)
    {
        if (!RegexRule.IsValidPattern(request.Pattern))
        {
            ModelState.AddModelError(nameof(request.Pattern), "Pattern is not a valid regular expression.");
            return ValidationProblem(ModelState);
        }

        if (request.ProjectId is not null
            && !await db.Projects.AnyAsync(p => p.Id == request.ProjectId, cancellationToken))
        {
            return NotFound();
        }

        var rule = new SanitizationRule
        {
            ProjectId = request.ProjectId,
            Pattern = request.Pattern,
            Replacement = request.Replacement
        };

        db.SanitizationRules.Add(rule);

        await db.SaveChangesAsync(cancellationToken);

        return Created((string?)null, Describe(rule));
    }

    /// <summary>Zmienia wzorzec i zamiennik reguly.</summary>
    /// <remarks>Tylko dla administratora.</remarks>
    [HttpPatch("{id:guid}")]
    [ProducesResponseType<SanitizationRuleResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SanitizationRuleResponse>> Update(
        Guid id,
        UpdateSanitizationRuleRequest request,
        CancellationToken cancellationToken)
    {
        if (!RegexRule.IsValidPattern(request.Pattern))
        {
            ModelState.AddModelError(nameof(request.Pattern), "Pattern is not a valid regular expression.");
            return ValidationProblem(ModelState);
        }

        var rule = await db.SanitizationRules.SingleOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (rule is null)
        {
            return NotFound();
        }

        rule.Pattern = request.Pattern;
        rule.Replacement = request.Replacement;

        await db.SaveChangesAsync(cancellationToken);

        return Ok(Describe(rule));
    }

    /// <summary>Wlacza albo wylacza regule.</summary>
    /// <remarks>Tylko dla administratora. Dziala od razu, bez restartu API.</remarks>
    [HttpPatch("{id:guid}/enabled")]
    [ProducesResponseType<SanitizationRuleResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SanitizationRuleResponse>> SetEnabled(
        Guid id,
        UpdateSanitizationRuleEnabledRequest request,
        CancellationToken cancellationToken)
    {
        var rule = await db.SanitizationRules.SingleOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (rule is null)
        {
            return NotFound();
        }

        rule.IsEnabled = request.IsEnabled!.Value;

        await db.SaveChangesAsync(cancellationToken);

        return Ok(Describe(rule));
    }

    /// <summary>Kasuje regule sanityzacji.</summary>
    /// <remarks>Tylko dla administratora.</remarks>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var rule = await db.SanitizationRules.SingleOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (rule is null)
        {
            return NotFound();
        }

        db.SanitizationRules.Remove(rule);

        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    /// <summary>Testuje regule na przykladowym tekscie bez zapisu.</summary>
    /// <remarks>Tylko dla administratora. Pokazuje wynik zanim regula trafi do bazy.</remarks>
    [HttpPost("test")]
    [ProducesResponseType<TestSanitizationRuleResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public ActionResult<TestSanitizationRuleResponse> Test(TestSanitizationRuleRequest request)
    {
        if (!RegexRule.TryApply(request.Pattern, request.Replacement, request.SampleText, out var result, out var matchCount))
        {
            ModelState.AddModelError(nameof(request.Pattern), "Pattern is not a valid regular expression or timed out.");
            return ValidationProblem(ModelState);
        }

        return Ok(new TestSanitizationRuleResponse(result, matchCount));
    }

    private static SanitizationRuleResponse Describe(SanitizationRule rule) => new(
        rule.Id, rule.ProjectId, rule.Pattern, rule.Replacement, rule.IsEnabled, rule.CreatedAt);
}
