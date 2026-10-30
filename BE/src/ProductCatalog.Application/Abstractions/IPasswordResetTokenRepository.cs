using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Application.Abstractions;

public interface IPasswordResetTokenRepository
{
    Task AddAsync(PasswordResetToken token, CancellationToken cancellationToken = default);
    Task<PasswordResetToken?> FindByHashAsync(string tokenHash, CancellationToken cancellationToken = default);

    /// <summary>Tokens of the user that are neither used nor expired at <paramref name="nowUtc"/>.</summary>
    Task<IReadOnlyList<PasswordResetToken>> GetActiveByUserIdAsync(
        Guid userId,
        DateTime nowUtc,
        CancellationToken cancellationToken = default);

    void Update(PasswordResetToken token);
}
