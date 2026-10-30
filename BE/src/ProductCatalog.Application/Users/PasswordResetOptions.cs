namespace ProductCatalog.Application.Users;

public sealed class PasswordResetOptions
{
    public const string SectionName = "PasswordReset";

    /// <summary>Front-end page that receives the token as the <c>token</c> query parameter.</summary>
    public string ResetUrl { get; init; } = string.Empty;

    public int TokenLifetimeMinutes { get; init; } = 30;
}
