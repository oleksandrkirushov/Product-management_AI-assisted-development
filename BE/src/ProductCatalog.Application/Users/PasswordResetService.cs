using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Application.Users;

/// <summary>
/// "Forgot password" flow: e-mails a one-time reset link and sets a new password by that link.
/// </summary>
public sealed class PasswordResetService(
    IUserRepository userRepository,
    IPasswordResetTokenRepository tokenRepository,
    IPasswordResetTokenGenerator tokenGenerator,
    IPasswordHasher passwordHasher,
    IEmailSender emailSender,
    IUnitOfWork unitOfWork,
    TimeProvider timeProvider,
    PasswordResetOptions options
    )
{
    private const string EmailSubject = "Reset your Product Catalog password";

    /// <summary>
    /// Sends a reset link to the active user with this e-mail. For an unknown or deactivated e-mail it does
    /// nothing and does not throw, so callers cannot tell whether an account exists.
    /// </summary>
    public async Task RequestResetAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
            return;

        var user = await userRepository.FindByEmailAsync(email.Trim(), cancellationToken);
        if (user is not { IsActive: true })
            return;

        var nowUtc = timeProvider.GetUtcNow().UtcDateTime;

        // Only the newest link works: every outstanding token of the user is invalidated.
        var previousTokens = await tokenRepository.GetActiveByUserIdAsync(user.Id, nowUtc, cancellationToken);
        foreach (var previousToken in previousTokens)
        {
            previousToken.MarkUsed(nowUtc);
            tokenRepository.Update(previousToken);
        }

        var token = tokenGenerator.GenerateToken();
        var resetToken = new PasswordResetToken(
            user.Id,
            tokenGenerator.HashToken(token),
            nowUtc,
            nowUtc.AddMinutes(options.TokenLifetimeMinutes));
        await tokenRepository.AddAsync(resetToken, cancellationToken);

        // Persisted before sending, so the link already works when the e-mail arrives.
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // CancellationToken.None: once the new token is committed (and the previous links revoked), the
        // e-mail must go out even if the client has disconnected meanwhile.
        await emailSender.SendAsync(user.Email, EmailSubject, BuildEmailBody(user, token), CancellationToken.None);
    }

    /// <summary>
    /// Sets a new password by a reset token and revokes all previously issued JWTs of the user.
    /// </summary>
    /// <exception cref="InvalidPasswordException">The new password violates <see cref="PasswordPolicy"/>.</exception>
    /// <exception cref="InvalidPasswordResetTokenException">
    /// The token is unknown, expired, already used, or its user is deactivated/deleted.
    /// </exception>
    public async Task ResetAsync(ResetPasswordCommand command, CancellationToken cancellationToken = default)
    {
        if (!PasswordPolicy.IsSatisfiedBy(command.NewPassword))
            throw new InvalidPasswordException();

        if (string.IsNullOrWhiteSpace(command.Token))
            throw new InvalidPasswordResetTokenException();

        var nowUtc = timeProvider.GetUtcNow().UtcDateTime;

        var resetToken = await tokenRepository.FindByHashAsync(tokenGenerator.HashToken(command.Token), cancellationToken);
        if (resetToken is null || !resetToken.IsUsable(nowUtc))
            throw new InvalidPasswordResetTokenException();

        var user = await userRepository.FindByIdAsync(resetToken.UserId, cancellationToken);
        if (user is not { IsActive: true })
            throw new InvalidPasswordResetTokenException();

        user.ChangePasswordHash(passwordHasher.Hash(command.NewPassword));
        userRepository.Update(user);

        resetToken.MarkUsed(nowUtc);
        tokenRepository.Update(resetToken);

        // One SaveChanges: the password change and the token consumption commit together.
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private string BuildEmailBody(User user, string token)
    {
        var separator = options.ResetUrl.Contains('?') ? '&' : '?';
        var link = $"{options.ResetUrl}{separator}token={Uri.EscapeDataString(token)}";

        return $"""
            Hello {user.FirstName},

            We received a request to reset the password for your Product Catalog account ({user.Username}).
            To choose a new password, open this link:

            {link}

            The link is valid for {options.TokenLifetimeMinutes} minutes and can be used only once.
            If you did not request a password reset, you can safely ignore this e-mail.
            """;
    }
}
