using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace AhorcadoPro.Backend.Data
{
    /// <summary>
    /// Design-time factory used exclusively by EF Core tools (dotnet ef migrations).
    /// Uses Npgsql with a placeholder connection string so migrations can be generated
    /// without a live database. Runtime configuration lives in Program.cs.
    /// </summary>
    public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
    {
        public ApplicationDbContext CreateDbContext(string[] args)
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql("Host=localhost;Database=ahorcado_design_time;Username=postgres;Password=postgres")
                .Options;

            return new ApplicationDbContext(options);
        }
    }
}
