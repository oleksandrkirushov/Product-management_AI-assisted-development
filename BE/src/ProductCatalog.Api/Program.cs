using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using ProductCatalog.Api.Authorization;
using ProductCatalog.Api.Options;
using ProductCatalog.Application;
using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;
using ProductCatalog.Infrastructure;
using ProductCatalog.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

var jwtSection = builder.Configuration.GetSection(JwtOptions.SectionName);
var jwtOptions = jwtSection.Get<JwtOptions>()
    ?? throw new InvalidOperationException("JWT configuration is missing.");
if (Encoding.UTF8.GetByteCount(jwtOptions.Key) < 32)
    throw new InvalidOperationException("JWT signing key must be at least 32 bytes.");

builder.Services.Configure<JwtOptions>(jwtSection);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtOptions.Issuer,
        ValidAudience = jwtOptions.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
        ClockSkew = TimeSpan.FromSeconds(30)
    };
});
builder.Services.AddAuthorization();
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddSingleton<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Product Catalog API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Enter JWT token only (without the word Bearer).",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });
});

var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "Healthy" })).AllowAnonymous();
await ApplyMigrationsAsync(app);
await app.RunAsync();

static async Task ApplyMigrationsAsync(WebApplication app)
{
    await using var scope = app.Services.CreateAsyncScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
    const int maxAttempts = 10;
    for (var attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            await dbContext.Database.MigrateAsync();
            await SeedRolesAsync(dbContext);
            await SeedAdminUserAsync(dbContext, passwordHasher, app.Configuration);
            return;
        }
        catch when (attempt < maxAttempts)
        {
            await Task.Delay(TimeSpan.FromSeconds(3));
        }
    }
}

static async Task SeedRolesAsync(AppDbContext dbContext)
{
    if (await dbContext.Roles.AnyAsync())
        return;

    dbContext.Roles.AddRange(
        new Role("Admin", ["*"]),
        new Role("User", ["products:read"]));

    await dbContext.SaveChangesAsync();
}

static async Task SeedAdminUserAsync(AppDbContext dbContext, IPasswordHasher passwordHasher, IConfiguration configuration)
{
    if (await dbContext.Users.AnyAsync())
        return;

    var adminRole = await dbContext.Roles.SingleOrDefaultAsync(x => x.Name == "Admin")
        ?? throw new InvalidOperationException("Admin role must be seeded before seeding the admin user.");

    var username = configuration["AdminSeed:Username"] ?? "admin";
    var email = configuration["AdminSeed:Email"] ?? "admin@productcatalog.local";
    var password = configuration["AdminSeed:Password"] ?? "Admin123!";

    var admin = new User(username, email, "System", "Administrator", passwordHasher.Hash(password), adminRole.Id);
    dbContext.Users.Add(admin);
    await dbContext.SaveChangesAsync();
}

public partial class Program;
