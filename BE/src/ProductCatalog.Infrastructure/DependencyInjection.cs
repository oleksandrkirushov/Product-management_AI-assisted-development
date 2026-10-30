using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ProductCatalog.Application.Abstractions;
using ProductCatalog.Infrastructure.Email;
using ProductCatalog.Infrastructure.Persistence;
using ProductCatalog.Infrastructure.Security;

namespace ProductCatalog.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration
        )
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");
        services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IPasswordResetTokenRepository, PasswordResetTokenRepository>();
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddSingleton<IPasswordResetTokenGenerator, PasswordResetTokenGenerator>();
        services.AddSingleton(ReadSmtpOptions(configuration));
        services.AddSingleton<IEmailSender, SmtpEmailSender>();
        services.AddSingleton(TimeProvider.System);
        services.AddScoped<IUnitOfWork>(provider => provider.GetRequiredService<AppDbContext>());
        return services;
    }

    // Read key by key (like AdminSeed in Program.cs): Infrastructure does not reference the configuration
    // binder package. Fails fast at startup instead of on the first e-mail.
    private static SmtpOptions ReadSmtpOptions(IConfiguration configuration)
    {
        var section = configuration.GetSection(SmtpOptions.SectionName);

        var host = section["Host"];
        if (string.IsNullOrWhiteSpace(host))
            throw new InvalidOperationException("SMTP host ('Smtp:Host') is not configured.");

        var from = section["From"];
        if (string.IsNullOrWhiteSpace(from))
            throw new InvalidOperationException("SMTP sender address ('Smtp:From') is not configured.");

        var port = 25;
        if (section["Port"] is { } portValue && (!int.TryParse(portValue, out port) || port is < 1 or > 65535))
            throw new InvalidOperationException("SMTP port ('Smtp:Port') must be a number between 1 and 65535.");

        var enableSsl = false;
        if (section["EnableSsl"] is { } sslValue && !bool.TryParse(sslValue, out enableSsl))
            throw new InvalidOperationException("'Smtp:EnableSsl' must be 'true' or 'false'.");

        return new SmtpOptions
        {
            Host = host,
            Port = port,
            From = from,
            EnableSsl = enableSsl,
            User = string.IsNullOrWhiteSpace(section["User"]) ? null : section["User"],
            Password = string.IsNullOrEmpty(section["Password"]) ? null : section["Password"]
        };
    }
}
