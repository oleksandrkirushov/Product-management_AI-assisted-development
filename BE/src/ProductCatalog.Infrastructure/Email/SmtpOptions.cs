namespace ProductCatalog.Infrastructure.Email;

internal sealed class SmtpOptions
{
    public const string SectionName = "Smtp";
    public string Host { get; init; } = string.Empty;
    public int Port { get; init; } = 25;
    public string From { get; init; } = string.Empty;
    public bool EnableSsl { get; init; }
    public string? User { get; init; }
    public string? Password { get; init; }
}
