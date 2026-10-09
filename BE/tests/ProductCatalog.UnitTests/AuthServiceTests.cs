using ProductCatalog.Application.Abstractions;
using ProductCatalog.Application.Auth;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.UnitTests;

public sealed class AuthServiceTests
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
        public List<Role> Items { get; } = [];

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

    [Fact]
    public async Task AuthenticateAsync_WithValidCredentials_ReturnsAuthenticatedUser()
    {
        var role = new Role("User", ["products:read"]);
        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "hashed:Secret123", role.Id);
        var userRepository = new InMemoryUserRepository { Items = { user } };
        var roleRepository = new InMemoryRoleRepository { Items = { role } };
        var service = new AuthService(userRepository, roleRepository, new FakePasswordHasher());

        var result = await service.AuthenticateAsync("jdoe", "Secret123");

        Assert.NotNull(result);
        Assert.Equal(user.Id, result!.Id);
        Assert.Equal("jdoe", result.Username);
        Assert.Equal("User", result.RoleName);
        Assert.Equal(["products:read"], result.Permissions);
    }

    [Fact]
    public async Task AuthenticateAsync_WithInvalidPassword_ReturnsNull()
    {
        var role = new Role("User", ["products:read"]);
        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "hashed:Secret123", role.Id);
        var userRepository = new InMemoryUserRepository { Items = { user } };
        var roleRepository = new InMemoryRoleRepository { Items = { role } };
        var service = new AuthService(userRepository, roleRepository, new FakePasswordHasher());

        var result = await service.AuthenticateAsync("jdoe", "WrongPassword");

        Assert.Null(result);
    }

    [Fact]
    public async Task AuthenticateAsync_WithUnknownUsername_ReturnsNull()
    {
        var userRepository = new InMemoryUserRepository();
        var roleRepository = new InMemoryRoleRepository();
        var service = new AuthService(userRepository, roleRepository, new FakePasswordHasher());

        var result = await service.AuthenticateAsync("unknown", "Secret123");

        Assert.Null(result);
    }
}
