namespace ProductCatalog.Api.RateLimiting;

public static class RateLimitingPolicies
{
    /// <summary>
    /// Fixed window per client IP, shared by forgot-password and reset-password: limits e-mail flooding
    /// and token guessing.
    /// </summary>
    public const string PasswordReset = "password-reset";

    public const int PasswordResetPermitLimit = 5;

    public static readonly TimeSpan PasswordResetWindow = TimeSpan.FromMinutes(1);
}
