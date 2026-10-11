using ProductCatalog.Application.Abstractions;
using ProductCatalog.Application.Users;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.UnitTests;

public sealed class UserManagementServiceTests
{
    private sealed class InMemoryUserRepository : IUserRepository
    {
        public List<User> Items { get; } = [];
        public int UpdateCalls { get; private set; }

        public Task<User?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Id == id));

        public Task<User?> FindByUsernameAsync(string username, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Username == username));

        public Task<User?> FindByEmailAsync(string email, CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.FirstOrDefault(x => x.Email == email));

        public Task<IReadOnlyList<User>> GetAllAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<User>>(Items);

        public Task<int> CountActiveByRoleIdsAsync(
            IReadOnlyCollection<Guid> roleIds,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(Items.Count(x => x.IsActive && roleIds.Contains(x.RoleId)));

        public Task AddAsync(User user, CancellationToken cancellationToken = default)
        {
            Items.Add(user);
            return Task.CompletedTask;
        }

        public void Update(User user) => UpdateCalls++;

        public void Remove(User user) => Items.Remove(user);
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

    private sealed class CountingUnitOfWork : IUnitOfWork
    {
        public int SaveCalls { get; private set; }

        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            SaveCalls++;
            return Task.FromResult(1);
        }
    }

    private readonly Role _adminRole = new("Admin", ["*"]);
    private readonly Role _userRole = new("User", ["products:read"]);
    private readonly InMemoryUserRepository _users = new();
    private readonly InMemoryRoleRepository _roles = new();
    private readonly CountingUnitOfWork _unitOfWork = new();
    private readonly User _admin;

    public UserManagementServiceTests()
    {
        _roles.Items.AddRange([_adminRole, _userRole]);
        _admin = AddUser("admin", _adminRole);
    }

    private UserManagementService CreateService() => new(_users, _roles, _unitOfWork);

    private User AddUser(string username, Role role)
    {
        var user = new User(username, $"{username}@example.com", "First", "Last", "hash", role.Id);
        _users.Items.Add(user);
        return user;
    }

    [Fact]
    public async Task DeactivateAsync_WithActiveRegularUser_DeactivatesAndSaves()
    {
        var target = AddUser("jdoe", _userRole);

        var result = await CreateService().DeactivateAsync(target.Id, _admin.Username);

        Assert.True(result);
        Assert.False(target.IsActive);
        Assert.Equal(1, _users.UpdateCalls);
        Assert.Equal(1, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task ActivateAsync_WithInactiveUser_ActivatesAndSaves()
    {
        var target = AddUser("jdoe", _userRole);
        target.Deactivate();

        var result = await CreateService().ActivateAsync(target.Id, _admin.Username);

        Assert.True(result);
        Assert.True(target.IsActive);
        Assert.Equal(1, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task DeleteAsync_WithRegularUser_RemovesAndSaves()
    {
        var target = AddUser("jdoe", _userRole);

        var result = await CreateService().DeleteAsync(target.Id, _admin.Username);

        Assert.True(result);
        Assert.DoesNotContain(target, _users.Items);
        Assert.Equal(1, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task ActivateAsync_WithAlreadyActiveUser_IsNoOpSuccess()
    {
        var target = AddUser("jdoe", _userRole);

        var result = await CreateService().ActivateAsync(target.Id, _admin.Username);

        Assert.True(result);
        Assert.True(target.IsActive);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task DeactivateAsync_WithAlreadyInactiveUser_IsNoOpSuccess()
    {
        var target = AddUser("jdoe", _userRole);
        target.Deactivate();

        var result = await CreateService().DeactivateAsync(target.Id, _admin.Username);

        Assert.True(result);
        Assert.False(target.IsActive);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task ActivateAsync_WithUnknownId_ReturnsFalse()
    {
        var result = await CreateService().ActivateAsync(Guid.NewGuid(), _admin.Username);

        Assert.False(result);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task DeactivateAsync_WithUnknownId_ReturnsFalse()
    {
        var result = await CreateService().DeactivateAsync(Guid.NewGuid(), _admin.Username);

        Assert.False(result);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task DeleteAsync_WithUnknownId_ReturnsFalse()
    {
        var result = await CreateService().DeleteAsync(Guid.NewGuid(), _admin.Username);

        Assert.False(result);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task ActivateAsync_OnSelf_ThrowsCannotModifySelfException() =>
        await Assert.ThrowsAsync<CannotModifySelfException>(
            () => CreateService().ActivateAsync(_admin.Id, _admin.Username));

    [Fact]
    public async Task DeactivateAsync_OnSelf_ThrowsCannotModifySelfException()
    {
        AddUser("second-admin", _adminRole);

        await Assert.ThrowsAsync<CannotModifySelfException>(
            () => CreateService().DeactivateAsync(_admin.Id, _admin.Username));

        Assert.True(_admin.IsActive);
    }

    [Fact]
    public async Task DeleteAsync_OnSelf_ThrowsCannotModifySelfException()
    {
        AddUser("second-admin", _adminRole);

        await Assert.ThrowsAsync<CannotModifySelfException>(
            () => CreateService().DeleteAsync(_admin.Id, _admin.Username));

        Assert.Contains(_admin, _users.Items);
    }

    [Fact]
    public async Task DeactivateAsync_OnLastActiveAdmin_ThrowsLastActiveAdminException()
    {
        var actor = AddUser("operator", _userRole);
        // The original admin is deactivated, so the target is the only remaining active admin.
        _admin.Deactivate();
        var lastAdmin = AddUser("last-admin", _adminRole);

        await Assert.ThrowsAsync<LastActiveAdminException>(
            () => CreateService().DeactivateAsync(lastAdmin.Id, actor.Username));

        Assert.True(lastAdmin.IsActive);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task DeleteAsync_OnLastActiveAdmin_ThrowsLastActiveAdminException()
    {
        var actor = AddUser("operator", _userRole);

        await Assert.ThrowsAsync<LastActiveAdminException>(
            () => CreateService().DeleteAsync(_admin.Id, actor.Username));

        Assert.Contains(_admin, _users.Items);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task DeactivateAsync_OnAdminWhenAnotherActiveAdminExists_Succeeds()
    {
        var otherAdmin = AddUser("other-admin", _adminRole);

        var result = await CreateService().DeactivateAsync(otherAdmin.Id, _admin.Username);

        Assert.True(result);
        Assert.False(otherAdmin.IsActive);
    }

    [Fact]
    public async Task DeleteAsync_OnAdminWhenAnotherActiveAdminExists_Succeeds()
    {
        var otherAdmin = AddUser("other-admin", _adminRole);

        var result = await CreateService().DeleteAsync(otherAdmin.Id, _admin.Username);

        Assert.True(result);
        Assert.DoesNotContain(otherAdmin, _users.Items);
    }

    [Fact]
    public async Task DeleteAsync_OnInactiveAdminWhileOnlyOneActiveAdmin_Succeeds()
    {
        var inactiveAdmin = AddUser("inactive-admin", _adminRole);
        inactiveAdmin.Deactivate();

        var result = await CreateService().DeleteAsync(inactiveAdmin.Id, _admin.Username);

        Assert.True(result);
        Assert.DoesNotContain(inactiveAdmin, _users.Items);
    }

    [Fact]
    public async Task DeactivateAsync_OnRegularUserWhileOnlyOneActiveAdmin_Succeeds()
    {
        var target = AddUser("jdoe", _userRole);

        var result = await CreateService().DeactivateAsync(target.Id, _admin.Username);

        Assert.True(result);
        Assert.False(target.IsActive);
        Assert.True(_admin.IsActive);
    }

    [Theory]
    [InlineData("*")]
    [InlineData("users:*")]
    [InlineData("users:manage")]
    public async Task DeactivateAsync_OnLastActiveUserOfRoleGrantingUsersManage_ThrowsLastActiveAdminException(
        string permission)
    {
        // Only the custom role grants users:manage, so the built-in admin is not counted.
        _roles.Items.Remove(_adminRole);
        var managerRole = new Role("Manager", [permission]);
        _roles.Items.Add(managerRole);
        var manager = AddUser("manager", managerRole);

        await Assert.ThrowsAsync<LastActiveAdminException>(
            () => CreateService().DeactivateAsync(manager.Id, _admin.Username));
    }

    [Fact]
    public async Task DeactivateAsync_OnLastUserOfRoleWithOnlyUsersRead_Succeeds()
    {
        var readerRole = new Role("Reader", ["users:read"]);
        _roles.Items.Add(readerRole);
        var reader = AddUser("reader", readerRole);

        var result = await CreateService().DeactivateAsync(reader.Id, _admin.Username);

        Assert.True(result);
        Assert.False(reader.IsActive);
    }

    [Fact]
    public async Task DeactivateAsync_CountsActiveAdminsAcrossAllAdminRoles()
    {
        var managerRole = new Role("Manager", ["users:*"]);
        _roles.Items.Add(managerRole);
        var actor = AddUser("operator", _userRole);
        AddUser("manager", managerRole);

        var result = await CreateService().DeactivateAsync(_admin.Id, actor.Username);

        Assert.True(result);
        Assert.False(_admin.IsActive);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ActivateAsync_WithBlankActingUsername_ThrowsArgumentException(string actingUsername)
    {
        var target = AddUser("jdoe", _userRole);

        await Assert.ThrowsAsync<ArgumentException>(
            () => CreateService().ActivateAsync(target.Id, actingUsername));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task DeactivateAsync_WithBlankActingUsername_ThrowsArgumentException(string actingUsername)
    {
        var target = AddUser("jdoe", _userRole);

        await Assert.ThrowsAsync<ArgumentException>(
            () => CreateService().DeactivateAsync(target.Id, actingUsername));

        Assert.True(target.IsActive);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task DeleteAsync_WithBlankActingUsername_ThrowsArgumentException(string actingUsername)
    {
        var target = AddUser("jdoe", _userRole);

        await Assert.ThrowsAsync<ArgumentException>(
            () => CreateService().DeleteAsync(target.Id, actingUsername));

        Assert.Contains(target, _users.Items);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task DeactivateAsync_WithNullActingUsername_ThrowsArgumentNullException() =>
        await Assert.ThrowsAsync<ArgumentNullException>(
            () => CreateService().DeactivateAsync(_admin.Id, null!));

    [Fact]
    public async Task DeactivateAsync_WhenActingUserDoesNotExist_DeactivatesTarget()
    {
        var target = AddUser("jdoe", _userRole);

        var result = await CreateService().DeactivateAsync(target.Id, "ghost");

        Assert.True(result);
        Assert.False(target.IsActive);
        Assert.Equal(1, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task DeactivateAsync_OnAlreadyInactiveAdminWithNoOtherActiveAdmins_IsNoOpSuccess()
    {
        // Idempotency is checked before the last-active-admin rule: no active admin is left at all here.
        var actor = AddUser("operator", _userRole);
        _admin.Deactivate();

        var result = await CreateService().DeactivateAsync(_admin.Id, actor.Username);

        Assert.True(result);
        Assert.False(_admin.IsActive);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task DeleteAsync_OnSelfAsOnlyActiveAdmin_ThrowsCannotModifySelfException()
    {
        // The self check runs before the last-active-admin rule, so it wins when both apply.
        await Assert.ThrowsAsync<CannotModifySelfException>(
            () => CreateService().DeleteAsync(_admin.Id, _admin.Username));

        Assert.Contains(_admin, _users.Items);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }
}
