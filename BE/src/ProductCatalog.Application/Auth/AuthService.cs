using ProductCatalog.Application.Abstractions;

namespace ProductCatalog.Application.Auth;

public sealed class AuthService(
    IUserRepository userRepository,
    IRoleRepository roleRepository,
    IPasswordHasher passwordHasher
    )
{
    public async Task<AuthenticatedUserDto?> AuthenticateAsync(
        string username,
        string password,
        CancellationToken cancellationToken = default
        )
    {
        var user = await userRepository.FindByUsernameAsync(username, cancellationToken);
        if (user is null)
            return null;

        if (!passwordHasher.Verify(password, user.PasswordHash))
            return null;

        // Checked after password verification so a deactivated account takes the same (hashing) path
        // as a wrong password and is indistinguishable from it by response or timing.
        if (!user.IsActive)
            return null;

        var role = await roleRepository.FindByIdAsync(user.RoleId, cancellationToken);
        if (role is null)
            return null;

        return new AuthenticatedUserDto(user.Id, user.Username, user.Email, role.Name, role.Permissions);
    }
}
