using AhorcadoPro.Backend.Authentication;
using AhorcadoPro.Backend.BackgroundServices;
using AhorcadoPro.Backend.Data;
using AhorcadoPro.Backend.Hubs;
using AhorcadoPro.Backend.Models;
using AhorcadoPro.Backend.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database — InMemory para local, Supabase PostgreSQL en producción
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("Default");
    if (string.IsNullOrEmpty(connectionString) || connectionString.Contains("localhost"))
        options.UseInMemoryDatabase("AhorcadoProDb");
    else
        options.UseNpgsql(connectionString);
});

// Auth via Supabase (valida tokens llamando a la API de Supabase)
builder.Services.AddHttpClient();
builder.Services.AddAuthentication("Supabase")
    .AddScheme<AuthenticationSchemeOptions, SupabaseAuthHandler>("Supabase", null);
builder.Services.AddAuthorization();

// CORS — SignalR requiere credenciales con origins específicos
builder.Services.AddCors(options =>
{
    options.AddPolicy("SignalRPolicy", policy =>
        policy.WithOrigins(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "https://ahorcado-pro.vercel.app",
                "https://ahorcado-pro.netlify.app"
              )
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials());
});

builder.Services.AddSignalR()
    .AddJsonProtocol(o =>
        o.PayloadSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));
builder.Services.AddSingleton<GameManager>();
builder.Services.AddHostedService<GameCleanupService>();
builder.Services.AddHttpClient<IAiService, GroqService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("SignalRPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<GameHub>("/hubs/game");

// Seed solo en InMemory (Supabase ya tiene los datos)
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    if (context.Database.IsInMemory() && !context.Words.Any())
    {
        context.Words.AddRange(
            // Generic — available for all profiles
            new Word { Text = "TECNOLOGIA",   Category = "general",             Difficulty = "medium", TargetProfile = "ambos" },
            new Word { Text = "PROGRAMACION", Category = "general",             Difficulty = "hard",   TargetProfile = "ambos" },
            new Word { Text = "ARGENTINA",    Category = "general",             Difficulty = "easy",   TargetProfile = "ambos" },
            new Word { Text = "GUITARRA",     Category = "general",             Difficulty = "easy",   TargetProfile = "ambos" },
            new Word { Text = "MARIPOSA",     Category = "general",             Difficulty = "easy",   TargetProfile = "ambos" },

            // Ciencias Naturales — primaria
            new Word { Text = "ECOSISTEMA",   Category = "ciencias_naturales",  Difficulty = "hard",   TargetProfile = "primaria", GradeLevel = "6to" },
            new Word { Text = "FOTOSINTESIS", Category = "ciencias_naturales",  Difficulty = "hard",   TargetProfile = "primaria", GradeLevel = "6to" },
            new Word { Text = "VERTEBRADO",   Category = "ciencias_naturales",  Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "5to" },
            new Word { Text = "ATMOSFERA",    Category = "ciencias_naturales",  Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "6to" },
            new Word { Text = "CELULA",       Category = "ciencias_naturales",  Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "7mo" },
            new Word { Text = "VOLCAN",       Category = "ciencias_naturales",  Difficulty = "easy",   TargetProfile = "primaria", GradeLevel = "5to" },
            new Word { Text = "MAMIFERO",     Category = "ciencias_naturales",  Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "5to" },
            new Word { Text = "OXIGENO",      Category = "ciencias_naturales",  Difficulty = "easy",   TargetProfile = "primaria", GradeLevel = "5to" },
            new Word { Text = "ENERGIA",      Category = "ciencias_naturales",  Difficulty = "easy",   TargetProfile = "primaria", GradeLevel = "6to" },
            new Word { Text = "PLANETA",      Category = "ciencias_naturales",  Difficulty = "easy",   TargetProfile = "primaria", GradeLevel = "5to" },

            // Ciencias Sociales — primaria
            new Word { Text = "DEMOCRACIA",   Category = "ciencias_sociales",   Difficulty = "hard",   TargetProfile = "primaria", GradeLevel = "7mo" },
            new Word { Text = "PROVINCIA",    Category = "ciencias_sociales",   Difficulty = "easy",   TargetProfile = "primaria", GradeLevel = "5to" },
            new Word { Text = "PARLAMENTO",   Category = "ciencias_sociales",   Difficulty = "hard",   TargetProfile = "primaria", GradeLevel = "7mo" },
            new Word { Text = "CONSTITUCION", Category = "ciencias_sociales",   Difficulty = "hard",   TargetProfile = "primaria", GradeLevel = "7mo" },
            new Word { Text = "MUNICIPIO",    Category = "ciencias_sociales",   Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "6to" },
            new Word { Text = "SOBERANIA",    Category = "ciencias_sociales",   Difficulty = "hard",   TargetProfile = "primaria", GradeLevel = "7mo" },
            new Word { Text = "CIVILIZACION", Category = "ciencias_sociales",   Difficulty = "hard",   TargetProfile = "primaria", GradeLevel = "7mo" },
            new Word { Text = "TERRITORIO",   Category = "ciencias_sociales",   Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "6to" },
            new Word { Text = "ECONOMIA",     Category = "ciencias_sociales",   Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "7mo" },
            new Word { Text = "CULTURA",      Category = "ciencias_sociales",   Difficulty = "easy",   TargetProfile = "primaria", GradeLevel = "5to" },

            // Lengua — primaria
            new Word { Text = "SINONIMO",     Category = "lengua",              Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "5to" },
            new Word { Text = "ANTONIMO",     Category = "lengua",              Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "5to" },
            new Word { Text = "SUSTANTIVO",   Category = "lengua",              Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "5to" },
            new Word { Text = "ADJETIVO",     Category = "lengua",              Difficulty = "easy",   TargetProfile = "primaria", GradeLevel = "5to" },
            new Word { Text = "PREDICADO",    Category = "lengua",              Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "6to" },
            new Word { Text = "SILABA",       Category = "lengua",              Difficulty = "easy",   TargetProfile = "primaria", GradeLevel = "5to" },
            new Word { Text = "PARRAFO",      Category = "lengua",              Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "5to" },
            new Word { Text = "NARRADOR",     Category = "lengua",              Difficulty = "medium", TargetProfile = "primaria", GradeLevel = "6to" },
            new Word { Text = "METAFORA",     Category = "lengua",              Difficulty = "hard",   TargetProfile = "primaria", GradeLevel = "7mo" },
            new Word { Text = "DIALOGO",      Category = "lengua",              Difficulty = "easy",   TargetProfile = "primaria", GradeLevel = "5to" },

            // Cultura General — adultos mayores
            new Word { Text = "JARDIN",       Category = "cultura_general",     Difficulty = "easy",   TargetProfile = "adultos_mayores" },
            new Word { Text = "RECETA",       Category = "cultura_general",     Difficulty = "easy",   TargetProfile = "adultos_mayores" },
            new Word { Text = "MEMORIA",      Category = "cultura_general",     Difficulty = "easy",   TargetProfile = "adultos_mayores" },
            new Word { Text = "CANCION",      Category = "cultura_general",     Difficulty = "easy",   TargetProfile = "adultos_mayores" },
            new Word { Text = "VIAJE",        Category = "cultura_general",     Difficulty = "easy",   TargetProfile = "adultos_mayores" },
            new Word { Text = "FAMILIA",      Category = "cultura_general",     Difficulty = "easy",   TargetProfile = "adultos_mayores" },
            new Word { Text = "HISTORIA",     Category = "cultura_general",     Difficulty = "medium", TargetProfile = "adultos_mayores" },
            new Word { Text = "TRADICION",    Category = "cultura_general",     Difficulty = "medium", TargetProfile = "adultos_mayores" },
            new Word { Text = "AMISTAD",      Category = "cultura_general",     Difficulty = "easy",   TargetProfile = "adultos_mayores" },
            new Word { Text = "NATURALEZA",   Category = "cultura_general",     Difficulty = "medium", TargetProfile = "adultos_mayores" }
        );
        context.SaveChanges();
    }
}

app.Run();
