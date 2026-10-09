namespace ProductCatalog.Domain.Entities;

public sealed class Role
{
    private Role() { }

    public Role(string name, IReadOnlyList<string> permissions)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Role name is required.", nameof(name));
        if (name.Trim().Length > 100)
            throw new ArgumentException("Role name cannot exceed 100 characters.", nameof(name));
        if (permissions is null || permissions.Count == 0)
            throw new ArgumentException("Role must have at least one permission.", nameof(permissions));

        Name = name.Trim();
        Permissions = permissions;
    }

    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Name { get; private set; } = string.Empty;
    public IReadOnlyList<string> Permissions { get; private set; } = new List<string>();
}
