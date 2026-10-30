namespace ProductCatalog.Domain.Entities;

public sealed class User
{
    private User() { }

    public User(
        string username,
        string email,
        string firstName,
        string lastName,
        string passwordHash,
        Guid roleId)
    {
        if (string.IsNullOrWhiteSpace(username))
            throw new ArgumentException("Username is required.", nameof(username));
        if (username.Trim().Length > 100)
            throw new ArgumentException("Username cannot exceed 100 characters.", nameof(username));
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email is required.", nameof(email));
        if (!IsValidEmail(email))
            throw new ArgumentException("Email format is invalid.", nameof(email));
        if (string.IsNullOrWhiteSpace(firstName))
            throw new ArgumentException("First name is required.", nameof(firstName));
        if (string.IsNullOrWhiteSpace(lastName))
            throw new ArgumentException("Last name is required.", nameof(lastName));
        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new ArgumentException("Password hash is required.", nameof(passwordHash));
        if (roleId == Guid.Empty)
            throw new ArgumentException("Role id is required.", nameof(roleId));

        Username = username.Trim();
        Email = email.Trim();
        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        PasswordHash = passwordHash;
        RoleId = roleId;
        IsActive = true;
        SecurityStamp = NewSecurityStamp();
        CreatedAtUtc = DateTime.UtcNow;
        UpdatedAtUtc = CreatedAtUtc;
    }

    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Username { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string FirstName { get; private set; } = string.Empty;
    public string LastName { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public Guid RoleId { get; private set; }
    public bool IsActive { get; private set; }

    /// <summary>
    /// Opaque value that changes on every password change. It is copied into issued JWTs, so a token
    /// whose stamp no longer matches belongs to a revoked session.
    /// </summary>
    public string SecurityStamp { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    public void ChangePasswordHash(string newPasswordHash)
    {
        if (string.IsNullOrWhiteSpace(newPasswordHash))
            throw new ArgumentException("Password hash is required.", nameof(newPasswordHash));

        PasswordHash = newPasswordHash;
        SecurityStamp = NewSecurityStamp();
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Activate()
    {
        if (IsActive)
            return;

        IsActive = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        if (!IsActive)
            return;

        IsActive = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    private static string NewSecurityStamp() => Guid.NewGuid().ToString("N");

    private static bool IsValidEmail(string email)
    {
        var trimmed = email.Trim();
        if (trimmed.Count(c => c == '@') != 1)
            return false;

        var atIndex = trimmed.IndexOf('@');
        var lastDotIndex = trimmed.LastIndexOf('.');
        return atIndex > 0
            && lastDotIndex > atIndex + 1
            && lastDotIndex < trimmed.Length - 1
            && !trimmed.Contains(' ');
    }
}
