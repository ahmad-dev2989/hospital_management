using System.Text;
using HospitalApp.Api.Middleware;
using HospitalApp.Infrastructure.Data;
using HospitalApp.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. Database Connection
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=127.0.0.1;Port=5432;Database=hospital_db;Username=postgres;Password=postgres";

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

// 2. Application Services & DI
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IPatientNumberGenerator, PatientNumberGenerator>();
builder.Services.AddScoped<IPatientService, PatientService>();
builder.Services.AddScoped<IAppointmentNumberGenerator, AppointmentNumberGenerator>();
builder.Services.AddScoped<IAppointmentService, AppointmentService>();
builder.Services.AddScoped<IClinicalService, ClinicalService>();
builder.Services.AddScoped<ILabService, LabService>();
builder.Services.AddScoped<IPharmacyService, PharmacyService>();
builder.Services.AddScoped<IBillingService, BillingService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IDocumentService, DocumentService>();
builder.Services.AddScoped<ISystemService, SystemService>();
builder.Services.AddHostedService<DatabaseBackupSchedulerService>();

// 3. JWT Authentication & Authorization
var jwtSecret = builder.Configuration["JwtSettings:Secret"] 
    ?? "HospitalManagementSystemSecureSecretKey2026!#$LocalOffline789456123";
var jwtIssuer = builder.Configuration["JwtSettings:Issuer"] ?? "HospitalApp.Local";
var jwtAudience = builder.Configuration["JwtSettings:Audience"] ?? "HospitalApp.Desktop";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// 4. Local Desktop CORS Configuration
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

// 5. API Controllers & Swagger with Bearer Support
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Hospital Management System API",
        Version = "v1",
        Description = "Local Offline Hospital Management System REST API"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Format: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Bind explicitly to loopback
builder.WebHost.UseUrls("http://127.0.0.1:5000");

var app = builder.Build();

// 6. Database Migration & Seed Verification
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

// 7. Middleware Pipeline
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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
