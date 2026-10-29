using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SprintLog.Api.Data;

/// <summary>
/// Wird nur von "dotnet ef" benutzt (Migrationen erzeugen / SQL-Skripte generieren).
/// So muss für Design-Time-Befehle weder JWT_SECRET noch eine echte Datenbank vorhanden sein.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? "Host=localhost;Database=sprintlog;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new AppDbContext(options);
    }
}
