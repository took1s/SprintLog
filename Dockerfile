# ---------- Build ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Erst nur die Projektdatei kopieren -> "dotnet restore" wird von Docker gecacht,
# solange sich die Paketreferenzen nicht ändern.
COPY SprintLog.Api/SprintLog.Api.csproj SprintLog.Api/
RUN dotnet restore SprintLog.Api/SprintLog.Api.csproj

COPY SprintLog.Api/ SprintLog.Api/
RUN dotnet publish SprintLog.Api/SprintLog.Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ---------- Runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true
EXPOSE 8080

COPY --from=build /app/publish .

# Nicht als root laufen (der Benutzer "app" ist im offiziellen .NET-8-Image vorhanden).
USER app

ENTRYPOINT ["dotnet", "SprintLog.Api.dll"]
