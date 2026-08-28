FROM mcr.microsoft.com/dotnet/sdk:10.0 AS restore
WORKDIR /src

# Future Web API project files should live in this build context.
COPY . .
RUN dotnet restore

FROM restore AS build
RUN dotnet publish --configuration Release --no-restore --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
ENV APP_DLL=

EXPOSE 8080

COPY --from=build /app/publish .

# wolumen zalacznikow dziedziczy wlasciciela z tego katalogu wiec musi powstac przed przelaczeniem uzytkownika
RUN mkdir -p /var/lib/bugshot/media && chown -R "$APP_UID:$APP_UID" /var/lib/bugshot

USER $APP_UID
ENTRYPOINT ["sh", "-c", "if [ -z \"$APP_DLL\" ]; then echo 'APP_DLL must be set to the published Web API DLL name.' >&2; exit 1; fi; dotnet \"$APP_DLL\""]
