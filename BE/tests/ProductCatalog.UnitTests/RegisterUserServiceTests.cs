using ProductCatalog.Application.Abstractions;
using ProductCatalog.Application.Users;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.UnitTests;

public sealed class RegisterUserServiceTests
{
    private sealed class InMemoryUserRepository : IUserRepository
    {
        public List<User> Items { get; } = [];

        public Task<User?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Id == id));

        public Task<User?> FindByUsernameAsync(string username, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Username == username));

        public Task<User?> FindByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Email == email));

        public Task AddAsync(User user, CancellationToken cancellationToken = default)
        {
            Items.Add(user);
            return Task.CompletedTask;
        }

        public void Update(User user) { }
    }

    private sealed class InMemoryRoleRepository : IRoleRepository
    {
        public List<Role> Items { get; } = [new("User", ["products:read"]), new("Admin", ["*"])];

        public Task<Role?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Id == id));

        public Task<Role?> FindByNameAsync(string name, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Name == name));
    }

    private sealed class FakePasswordHasher : IPasswordHasher
    {
        public string Hash(string password) => $"hashed:{password}";

        public bool Verify(string password, string passwordHash) => passwordHash == $"hashed:{password}";
    }

    private sealed class NoopUnitOfWork : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(1);
    }

    private static RegisterUserService CreateService(
        InMemoryUserRepository? userRepository = null,
        InMemoryRoleRepository? roleRepository = null) =>
        new(
            userRepository ?? new InMemoryUserRepository(),
            roleRepository ?? new InMemoryRoleRepository(),
            new FakePasswordHasher(),
            new NoopUnitOfWork());

    private static RegisterUserCommand ValidCommand() =>
        new("jdoe", "jdoe@example.com", "John", "Doe", "StrongPass1");

    [Fact]
    public async Task RegisterAsync_WithValidCommand_CreatesUserWithDefaultRoleAndHashedPassword()
    {
        var userRepository = new InMemoryUserRepository();
        var roleRepository = new InMemoryRoleRepository();
        var service = CreateService(userRepository, roleRepository);

        var response = await service.RegisterAsync(ValidCommand());

        Assert.Equal("jdoe", response.Username);
        Assert.Equal("jdoe@example.com", response.Email);
        Assert.Equal("John", response.FirstName);
        Assert.Equal("Doe", response.LastName);
        Assert.Single(userRepository.Items);

        var createdUser = userRepository.Items[0];
        Assert.Equal("hashed:StrongPass1", createdUser.PasswordHash);
        var userRole = roleRepository.Items.Single(x => x.Name == "User");
        Assert.Equal(userRole.Id, createdUser.RoleId);
    }

    [Fact]
    public async Task RegisterAsync_WithDuplicateUsername_ThrowsDuplicateUsernameException()
    {
        var userRepository = new InMemoryUserRepository();
        var roleId = new InMemoryRoleRepository().Items.Single(x => x.Name == "User").Id;
        userRepository.Items.Add(new User("jdoe", "existing@example.com", "Jane", "Doe", "hash", roleId));
        var service = CreateService(userRepository);

        await Assert.ThrowsAsync<DuplicateUsernameException>(() => service.RegisterAsync(ValidCommand()));
    }

    [Fact]
    public async Task RegisterAsync_WithDuplicateEmail_ThrowsDuplicateEmailException()
    {
        var userRepository = new InMemoryUserRepository();
        var roleId = new InMemoryRoleRepository().Items.Single(x => x.Name == "User").Id;
        userRepository.Items.Add(new User("other", "jdoe@example.com", "Jane", "Doe", "hash", roleId));
        var service = CreateService(userRepository);

        await Assert.ThrowsAsync<DuplicateEmailException>(() => service.RegisterAsync(ValidCommand()));
    }

    [Theory]
    [InlineData("")]
    [InlineData("short1")]
    public async Task RegisterAsync_WithWeakPassword_ThrowsArgumentException(string password)
    {
        var service = CreateService();
        var command = new RegisterUserCommand("jdoe", "jdoe@example.com", "John", "Doe", password);

        await Assert.ThrowsAsync<ArgumentException>(() => service.RegisterAsync(command));
    }
}
