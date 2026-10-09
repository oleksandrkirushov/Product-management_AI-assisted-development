using ProductCatalog.Application.Abstractions;
using ProductCatalog.Application.Users;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.UnitTests;

public sealed class UserProfileServiceTests
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

        public Task<IReadOnlyList<User>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<User>>(Items);

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

        public Task<IReadOnlyList<Role>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Role>>(Items);
    }

    [Fact]
    public async Task GetByUsernameAsync_WithExistingUser_ReturnsProfile()
    {
        var role = new Role("User", ["products:read"]);
        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "hashed", role.Id);
        var userRepository = new InMemoryUserRepository { Items = { user } };
        var roleRepository = new InMemoryRoleRepository { Items = { role } };
        var service = new UserProfileService(userRepository, roleRepository);

        var result = await service.GetByUsernameAsync("jdoe");

        Assert.NotNull(result);
        Assert.Equal(user.Id, result!.Id);
        Assert.Equal("jdoe", result.Username);
        Assert.Equal(["User"], result.Roles);
        Assert.Equal(["products:read"], result.Permissions);
    }

    [Fact]
    public async Task GetByUsernameAsync_WithUnknownUsername_ReturnsNull()
    {
        var userRepository = new InMemoryUserRepository();
        var roleRepository = new InMemoryRoleRepository();
        var service = new UserProfileService(userRepository, roleRepository);

        var result = await service.GetByUsernameAsync("unknown");

        Assert.Null(result);
    }

    [Fact]
    public async Task GetByIdAsync_WithExistingUser_ReturnsProfile()
    {
        var role = new Role("User", ["products:read"]);
        var user = new User("jdoe", "jdoe@example.com", "John", "Doe", "hashed", role.Id);
        var userRepository = new InMemoryUserRepository { Items = { user } };
        var roleRepository = new InMemoryRoleRepository { Items = { role } };
        var service = new UserProfileService(userRepository, roleRepository);

        var result = await service.GetByIdAsync(user.Id);

        Assert.NotNull(result);
        Assert.Equal(user.Id, result!.Id);
        Assert.Equal("jdoe", result.Username);
    }

    [Fact]
    public async Task GetByIdAsync_WithUnknownId_ReturnsNull()
    {
        var userRepository = new InMemoryUserRepository();
        var roleRepository = new InMemoryRoleRepository();
        var service = new UserProfileService(userRepository, roleRepository);

        var result = await service.GetByIdAsync(Guid.NewGuid());

        Assert.Null(result);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAllUsersWithRoleInformation()
    {
        var adminRole = new Role("Admin", ["*"]);
        var userRole = new Role("User", ["products:read"]);
        var admin = new User("admin", "admin@example.com", "System", "Administrator", "hashed", adminRole.Id);
        var regular = new User("jdoe", "jdoe@example.com", "John", "Doe", "hashed", userRole.Id);
        var userRepository = new InMemoryUserRepository { Items = { admin, regular } };
        var roleRepository = new InMemoryRoleRepository { Items = { adminRole, userRole } };
        var service = new UserProfileService(userRepository, roleRepository);

        var result = await service.GetAllAsync();

        Assert.Equal(2, result.Count);
        Assert.Contains(result, x => x.Username == "admin" && x.Roles.SequenceEqual(["Admin"]));
        Assert.Contains(result, x => x.Username == "jdoe" && x.Roles.SequenceEqual(["User"]));
    }
}
