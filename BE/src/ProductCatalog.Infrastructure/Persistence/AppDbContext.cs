using System.Linq;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IUnitOfWork
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var product = modelBuilder.Entity<Product>();
        product.ToTable("Products");
        product.HasKey(x => x.Id);
        product.Property(x => x.Name).HasMaxLength(200).IsRequired();
        product.Property(x => x.Price).HasPrecision(18, 2).IsRequired();
        product.Property(x => x.CreatedAtUtc).IsRequired();

        var role = modelBuilder.Entity<Role>();
        role.ToTable("Roles");
        role.HasKey(x => x.Id);
        role.Property(x => x.Name).HasMaxLength(100).IsRequired();
        role.HasIndex(x => x.Name).IsUnique();
        role.Property(x => x.Permissions)
            .HasConversion(
                permissions => JsonSerializer.Serialize(permissions, (JsonSerializerOptions?)null),
                json => JsonSerializer.Deserialize<List<string>>(json, (JsonSerializerOptions?)null) ?? new List<string>(),
                new ValueComparer<IReadOnlyList<string>>(
                    (a, b) => (a ?? new List<string>()).SequenceEqual(b ?? new List<string>()),
                    v => (v ?? new List<string>()).Aggregate(0, (hash, item) => HashCode.Combine(hash, item.GetHashCode())),
                    v => v.ToList()))
            .IsRequired();

        var user = modelBuilder.Entity<User>();
        user.ToTable("Users");
        user.HasKey(x => x.Id);
        user.Property(x => x.Username).HasMaxLength(100).IsRequired();
        user.Property(x => x.Email).HasMaxLength(256).IsRequired();
        user.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
        user.Property(x => x.LastName).HasMaxLength(100).IsRequired();
        user.Property(x => x.PasswordHash).IsRequired();
        user.Property(x => x.RoleId).IsRequired();
        user.Property(x => x.IsActive).IsRequired();
        user.Property(x => x.SecurityStamp).HasMaxLength(64).IsRequired();
        user.Property(x => x.CreatedAtUtc).IsRequired();
        user.Property(x => x.UpdatedAtUtc).IsRequired();
        user.HasIndex(x => x.Username).IsUnique();
        user.HasIndex(x => x.Email).IsUnique();
        user.HasOne<Role>()
            .WithMany()
            .HasForeignKey(x => x.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        var passwordResetToken = modelBuilder.Entity<PasswordResetToken>();
        passwordResetToken.ToTable("PasswordResetTokens");
        passwordResetToken.HasKey(x => x.Id);
        passwordResetToken.Property(x => x.UserId).IsRequired();
        passwordResetToken.Property(x => x.TokenHash).HasMaxLength(PasswordResetToken.TokenHashMaxLength).IsRequired();
        passwordResetToken.Property(x => x.ExpiresAtUtc).IsRequired();
        passwordResetToken.Property(x => x.CreatedAtUtc).IsRequired();
        passwordResetToken.HasIndex(x => x.TokenHash).IsUnique();
        passwordResetToken.HasOne<User>()
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
