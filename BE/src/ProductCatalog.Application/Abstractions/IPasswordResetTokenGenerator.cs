namespace ProductCatalog.Application.Abstractions;

public interface IPasswordResetTokenGenerator
{
    /// <summary>Creates a new cryptographically random, URL-safe token.</summary>
    string GenerateToken();

    /// <summary>Deterministic one-way hash of a token; only this value is persisted.</summary>
    string HashToken(string token);
}
