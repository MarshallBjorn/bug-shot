using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace BugShot.Api.OpenApi;

public static class OpenApiSetup
{
    public const string SecuritySchemeName = "bearerAuth";

    public static OpenApiOptions Describe(this OpenApiOptions options)
    {
        options.AddDocumentTransformer((document, context, cancellationToken) =>
        {
            document.Info.Title = "Bug-shot API";
            document.Info.Version = "v1";
            document.Info.Description =
                "Zgloszenia bugow ze stron WWW. Widget wysyla zgloszenie i zalaczniki bez konta, "
                + "reszta tras wymaga tokena z panelu. Opis modelu i decyzji projektowych jest w docs/api.md.";

            // bez tego schematu Swagger UI nie ma jak wyslac naglowka
            // i kazde klikniecie w trase za tokenem konczy sie na 401
            document.Components ??= new OpenApiComponents();
            document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();

            document.Components.SecuritySchemes[SecuritySchemeName] = new OpenApiSecurityScheme
            {
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                Description = "Access token z POST /api/v1/auth/login. Wpisz sam token bez slowa Bearer."
            };

            return Task.CompletedTask;
        });

        options.AddOperationTransformer((operation, context, cancellationToken) =>
        {
            // widget i endpointy sesji dzialaja bez konta wiec nie maja czego wymagac
            var anonymous = context.Description.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any();

            if (!anonymous)
            {
                operation.Security =
                [
                    new OpenApiSecurityRequirement
                    {
                        [new OpenApiSecuritySchemeReference(SecuritySchemeName, context.Document)] = []
                    }
                ];
            }

            return Task.CompletedTask;
        });

        return options;
    }
}
