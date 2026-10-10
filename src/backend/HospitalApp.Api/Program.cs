using HospitalApp.Api.Middleware;
using HospitalApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// 1. Database Connection
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=127.0.0.1;Port=5432;Database=hospital_db;Username=postgres;Password=postgres";

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

// 2. Local Desktop CORS Configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalDesktopPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "tauri://localhost")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 3. API Controllers & Documentation
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Hospital Management System API",
        Version = "v1",
        Description = "Local Offline Hospital Management System REST API"
    });
});

// Bind explicitly to loopback
builder.WebHost.UseUrls("http://127.0.0.1:5000");

var app = builder.Build();

// 4. Database Migration & Seed Verification
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    var dbContext = services.GetRequiredService<ApplicationDbContext>();
    
    try
    {
        logger.LogInformation("Verifying database connection and applying initial migrations...");
        await DatabaseSeeder.SeedAsync(dbContext, logger);
        logger.LogInformation("Database ready and verified.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to apply database migrations and seed data on startup.");
    }
}

// 5. Middleware Pipeline
app.UseMiddleware<GlobalExceptionMiddleware>();

if (app.Environment.IsDevelopment() || true) // Enable swagger locally
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "HospitalApp API v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseCors("LocalDesktopPolicy");

app.UseRouting();

app.UseAuthorization();

app.MapControllers();

app.Run();
