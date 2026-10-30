using System.Net;
using System.Net.Mail;
using ProductCatalog.Application.Abstractions;

namespace ProductCatalog.Infrastructure.Email;

internal sealed class SmtpEmailSender(SmtpOptions smtp) : IEmailSender
{
    public async Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
    {
        using var message = new MailMessage(smtp.From, to, subject, body) { IsBodyHtml = false };
        using var client = new SmtpClient(smtp.Host, smtp.Port) { EnableSsl = smtp.EnableSsl };
        if (!string.IsNullOrEmpty(smtp.User))
            client.Credentials = new NetworkCredential(smtp.User, smtp.Password);

        await client.SendMailAsync(message, cancellationToken);
    }
}
