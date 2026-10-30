using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Application.Users;

public sealed class RegisterUserService(
    IUserRepository userRepository,
    IRoleRepository roleRepository,
    IPasswordHasher passwordHasher,
    IUnitOfWork unitOfWork
    )
{
    private const string DefaultRoleName = "User";

    public async Task<CreateUserResponse> RegisterAsync(
        RegisterUserCommand command,
        CancellationToken cancellationToken = default
        )
    {
        if (!PasswordPolicy.IsSatisfiedBy(command.Password))
            throw new ArgumentException(PasswordPolicy.TooShortMessage, nameof(command));

        if (await userRepository.FindByUsernameAsync(command.Username, cancellationToken) is not null)
            throw new DuplicateUsernameException(command.Username);

        if (await userRepository.FindByEmailAsync(command.Email, cancellationToken) is not null)
            throw new DuplicateEmailException(command.Email);

        var defaultRole = await roleRepository.FindByNameAsync(DefaultRoleName, cancellationToken)
            ?? throw new InvalidOperationException($"Default role '{DefaultRoleName}' is not configured.");

        var passwordHash = passwordHasher.Hash(command.Password);
        var user = new User(
            command.Username,
            command.Email,
            command.FirstName,
            command.LastName,
            passwordHash,
            defaultRole.Id);

        await userRepository.AddAsync(user, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return Map(user);
    }

    private static CreateUserResponse Map(User user) => new(
        user.Id,
        user.Username,
        user.Email,
        user.FirstName,
        user.LastName,
        user.CreatedAtUtc);
}
