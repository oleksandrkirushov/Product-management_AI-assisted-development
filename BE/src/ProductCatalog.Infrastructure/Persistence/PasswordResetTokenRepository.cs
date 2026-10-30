using Microsoft.EntityFrameworkCore;
using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Infrastructure.Persistence;

internal sealed class PasswordResetTokenRepository(AppDbContext dbContext) : IPasswordResetTokenRepository
{
    public async Task AddAsync(PasswordResetToken token, CancellationToken cancellationToken = default) =>
        await dbContext.PasswordResetTokens.AddAsync(token, cancellationToken);

    public Task<PasswordResetToken?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
        dbContext.PasswordResetTokens.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);

    public async Task<IReadOnlyList<PasswordResetToken>> GetActiveByUserIdAsync(
        Guid userId,
        DateTime nowUtc,
        CancellationToken cancellationToken = default) =>
        await dbContext.PasswordResetTokens.AsNoTracking()
            .Where(x => x.UserId == userId && x.UsedAtUtc == null && x.ExpiresAtUtc > nowUtc)
            .ToListAsync(cancellationToken);

    public void Update(PasswordResetToken token) =>
        dbContext.PasswordResetTokens.Update(token);
}
