using ProductCatalog.Application.Abstractions;
using ProductCatalog.Application.Authorization;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Application.Users;

/// <summary>
/// Administrative state changes on user accounts. Each method returns <c>false</c> when the target
/// user does not exist, and <c>true</c> when the operation succeeded (including idempotent no-ops).
/// </summary>
public sealed class UserManagementService(
    IUserRepository userRepository,
    IRoleRepository roleRepository,
    IUnitOfWork unitOfWork
    )
{
    public async Task<bool> ActivateAsync(
        Guid id,
        string actingUsername,
        CancellationToken cancellationToken = default
        )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(actingUsername);

        var user = await userRepository.FindByIdAsync(id, cancellationToken);
        if (user is null)
            return false;

        await EnsureNotSelfAsync(user, actingUsername, cancellationToken);

        if (user.IsActive)
            return true;

        user.Activate();
        userRepository.Update(user);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeactivateAsync(
        Guid id,
        string actingUsername,
        CancellationToken cancellationToken = default
        )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(actingUsername);

        var user = await userRepository.FindByIdAsync(id, cancellationToken);
        if (user is null)
            return false;

        await EnsureNotSelfAsync(user, actingUsername, cancellationToken);

        if (!user.IsActive)
            return true;

        await EnsureNotLastActiveAdminAsync(user, cancellationToken);

        user.Deactivate();
        userRepository.Update(user);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteAsync(
        Guid id,
        string actingUsername,
        CancellationToken cancellationToken = default
        )
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(actingUsername);

        var user = await userRepository.FindByIdAsync(id, cancellationToken);
        if (user is null)
            return false;

        await EnsureNotSelfAsync(user, actingUsername, cancellationToken);

        if (user.IsActive)
            await EnsureNotLastActiveAdminAsync(user, cancellationToken);

        userRepository.Remove(user);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task EnsureNotSelfAsync(User target, string actingUsername, CancellationToken cancellationToken)
    {
        // Resolve the acting user through the repository (same lookup semantics as login) and compare by Id,
        // rather than comparing raw username strings.
        var actingUser = await userRepository.FindByUsernameAsync(actingUsername, cancellationToken);
        if (actingUser is not null && actingUser.Id == target.Id)
            throw new CannotModifySelfException();
    }

    // Known limitation: this check and the subsequent save do not run in one transaction, so two admins
    // concurrently deactivating/deleting each other can leave the system with no active admin.
    // Accepted deliberately; wrap the operation in a serializable transaction if that ever matters.
    private async Task EnsureNotLastActiveAdminAsync(User target, CancellationToken cancellationToken)
    {
        var roles = await roleRepository.GetAllAsync(cancellationToken);
        var adminRoleIds = roles
            .Where(role => PermissionMatcher.IsGranted(role.Permissions, Permissions.UsersManage))
            .Select(role => role.Id)
            .ToList();

        if (!adminRoleIds.Contains(target.RoleId))
            return;

        var activeAdmins = await userRepository.CountActiveByRoleIdsAsync(adminRoleIds, cancellationToken);
        if (activeAdmins <= 1)
            throw new LastActiveAdminException();
    }
}
