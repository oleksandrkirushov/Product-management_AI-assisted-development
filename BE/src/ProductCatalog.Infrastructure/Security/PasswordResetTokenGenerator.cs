using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using ProductCatalog.Application.Abstractions;

namespace ProductCatalog.Infrastructure.Security;

internal sealed class PasswordResetTokenGenerator : IPasswordResetTokenGenerator
{
    private const int TokenSizeInBytes = 32;

    public string GenerateToken() =>
        Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(TokenSizeInBytes));

    // SHA-256 without salt is sufficient here: the input is 256 bits of randomness, not a guessable
    // password, and the hash must be deterministic so the token can be looked up by it.
    // Hex output is exactly 64 characters (PasswordResetToken.TokenHashMaxLength).
    public string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
