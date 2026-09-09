using System.Net.Mime;
using BugShot.Api.Attachments;
using BugShot.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

        options.AddOperationTransformer((operation, context, cancellationToken) =>
        {
            // wysylka zalacznikow czyta strumien sama wiec nie ma modelu z ktorego
            // dokument wyprowadzilby cialo i naglowek. Bez tego nie da sie jej wyklikac
            var multipart = context.Description.ActionDescriptor.EndpointMetadata
                .OfType<ConsumesAttribute>()
                .Any(consumes => consumes.ContentTypes.Contains(MediaTypeNames.Multipart.FormData));

            if (multipart)
            {
                DescribeUploadForm(operation);
            }

            return Task.CompletedTask;
        });

        return options;
    }

    private static void DescribeUploadForm(OpenApiOperation operation)
    {
        var file = new OpenApiSchema { Type = JsonSchemaType.String, Format = "binary" };

        operation.RequestBody = new OpenApiRequestBody
        {
            Content = new Dictionary<string, OpenApiMediaType>
            {
                [MediaTypeNames.Multipart.FormData] = new()
                {
                    Schema = new OpenApiSchema
                    {
                        Type = JsonSchemaType.Object,
                        Properties = new Dictionary<string, IOpenApiSchema>
                        {
                            [AttachmentLimits.ScreenshotField] = file,
                            [AttachmentLimits.FilesField] = new OpenApiSchema
                            {
                                Type = JsonSchemaType.Array,
                                Items = file,
                                MaxItems = AttachmentLimits.MaxFiles
                            },
                            [AttachmentLimits.ConsoleLogField] = file
                        }
                    }
                }
            }
        };

        operation.Parameters ??= [];

        operation.Parameters.Add(new OpenApiParameter
        {
            Name = UploadToken.HeaderName,
            In = ParameterLocation.Header,
            Required = true,
            Description = "Jednorazowy token z odpowiedzi POST /tickets.",
            Schema = new OpenApiSchema { Type = JsonSchemaType.String }
        });
    }
}
