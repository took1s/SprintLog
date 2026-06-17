# Этап 1: Сборка приложения
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Копируем файл проекта и восстанавливаем зависимости
COPY ["SprintLog.Api.csproj", "."]
RUN dotnet restore "SprintLog.Api.csproj"

# Копируем весь остальной код и собираем его
COPY . .
RUN dotnet publish "SprintLog.Api.csproj" -c Release -o /app/publish

# Этап 2: Запуск готового приложения
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Указываем .NET слушать порт, который выделит Render
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "SprintLog.Api.dll"]