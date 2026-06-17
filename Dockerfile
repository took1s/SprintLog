FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Копируем файл проекта с учетом подпапки
COPY ["SprintLog.Api/SprintLog.Api.csproj", "SprintLog.Api/"]
RUN dotnet restore "SprintLog.Api/SprintLog.Api.csproj"

# Копируем абсолютно все файлы репозитория
COPY . .
WORKDIR "/src/SprintLog.Api"
RUN dotnet publish "SprintLog.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "SprintLog.Api.dll"]