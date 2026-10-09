using Microsoft.Extensions.DependencyInjection;
using ProductCatalog.Application.Auth;
using ProductCatalog.Application.Products;
using ProductCatalog.Application.Users;

namespace ProductCatalog.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ProductService>();
        services.AddScoped<RegisterUserService>();
        services.AddScoped<AuthService>();
        services.AddScoped<UserProfileService>();
        return services;
    }
}
