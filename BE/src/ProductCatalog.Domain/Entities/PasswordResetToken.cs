namespace ProductCatalog.Domain.Entities;

/// <summary>
/// One-time password reset token. Only a hash of the token is stored: the raw value exists only in
/// the e-mail sent to the user, so a database leak does not hand out working reset links.
/// </summary>
public sealed class PasswordResetToken
{
    public const int TokenHashMaxLength = 64;

    private PasswordResetToken() { }

    public PasswordResetToken(Guid userId, string tokenHash, DateTime createdAtUtc, DateTime expiresAtUtc)
    {
        if (userId == Guid.Empty)
            throw new ArgumentException("User id is required.", nameof(userId));
        if (string.IsNullOrWhiteSpace(tokenHash))
            throw new ArgumentException("Token hash is required.", nameof(tokenHash));
        if (tokenHash.Length > TokenHashMaxLength)
            throw new ArgumentException(
                $"Token hash cannot exceed {TokenHashMaxLength} characters.", nameof(tokenHash));
        if (expiresAtUtc <= createdAtUtc)
            throw new ArgumentOutOfRangeException(
                nameof(expiresAtUtc), "Expiration must be later than creation time.");

        UserId = userId;
        TokenHash = tokenHash;
        CreatedAtUtc = createdAtUtc;
        ExpiresAtUtc = expiresAtUtc;
    }

    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public string TokenHash { get; private set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; private set; }
    public DateTime? UsedAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    public bool IsUsable(DateTime nowUtc) => UsedAtUtc is null && nowUtc < ExpiresAtUtc;

    /// <summary>
    /// Consumes the token. Also used to invalidate an outstanding token when a newer one is issued.
    /// </summary>
    public void MarkUsed(DateTime nowUtc)
    {
        if (UsedAtUtc is not null)
            throw new InvalidOperationException("Password reset token has already been used.");

        UsedAtUtc = nowUtc;
    }
}
