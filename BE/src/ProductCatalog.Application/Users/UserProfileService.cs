using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Application.Users;

public sealed class UserProfileService(
    IUserRepository userRepository,
    IRoleRepository roleRepository
    )
{
    public async Task<UserProfileResponse?> GetByUsernameAsync(
        string username,
        CancellationToken cancellationToken = default
        )
    {
        var user = await userRepository.FindByUsernameAsync(username, cancellationToken);
        if (user is null)
            return null;

        var role = await roleRepository.FindByIdAsync(user.RoleId, cancellationToken);
        return Map(user, role);
    }

    public async Task<UserProfileResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.FindByIdAsync(id, cancellationToken);
        if (user is null)
            return null;

        var role = await roleRepository.FindByIdAsync(user.RoleId, cancellationToken);
        return Map(user, role);
    }

    public async Task<IReadOnlyList<UserProfileResponse>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var users = await userRepository.GetAllAsync(cancellationToken);
        var roles = await roleRepository.GetAllAsync(cancellationToken);
        var rolesById = roles.ToDictionary(x => x.Id);

        return users
            .Select(user => Map(user, rolesById.GetValueOrDefault(user.RoleId)))
            .ToList();
    }

    private static UserProfileResponse Map(User user, Role? role) => new(
        user.Id,
        user.Username,
        user.Email,
        user.FirstName,
        user.LastName,
        role is null ? [] : [role.Name],
        role?.Permissions ?? [],
        user.IsActive,
        user.CreatedAtUtc);
}
