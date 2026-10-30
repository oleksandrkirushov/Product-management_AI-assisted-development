namespace ProductCatalog.Application.Users;

public sealed class ResetPasswordCommand
{
    public ResetPasswordCommand(string token, string newPassword)
    {
        Token = token;
        NewPassword = newPassword;
    }

    public string Token { get; }
    public string NewPassword { get; }
}
