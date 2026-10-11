using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ProductCatalog.Api.Controllers;
using ProductCatalog.Application.Abstractions;
using ProductCatalog.Application.Users;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Api.UnitTests;

public sealed class UsersControllerTests
{
    private sealed class InMemoryUserRepository : IUserRepository
    {
        public List<User> Items { get; } = [];
        public int FindByIdCalls { get; private set; }

        public Task<User?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            FindByIdCalls++;
            return Task.FromResult(Items.FirstOrDefault(x => x.Id == id));
        }

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

        public void Update(User user)
        {
        }

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

    public enum ManageAction
    {
        Activate,
        Deactivate,
        Delete
    }

    private readonly Role _adminRole = new("Admin", ["*"]);
    private readonly Role _userRole = new("User", ["products:read"]);
    private readonly InMemoryUserRepository _users = new();
    private readonly InMemoryRoleRepository _roles = new();
    private readonly CountingUnitOfWork _unitOfWork = new();
    private readonly User _admin;

    public UsersControllerTests()
    {
        _roles.Items.AddRange([_adminRole, _userRole]);
        _admin = AddUser("admin", _adminRole);
    }

    private User AddUser(string username, Role role)
    {
        var user = new User(username, $"{username}@example.com", "First", "Last", "hash", role.Id);
        _users.Items.Add(user);
        return user;
    }

    private UsersController CreateController(string? actingUsername)
    {
        var identity = actingUsername is null
            ? new ClaimsIdentity()
            : new ClaimsIdentity([new Claim(ClaimTypes.Name, actingUsername)], authenticationType: "Test");

        return new UsersController(
            new UserProfileService(_users, _roles),
            new UserManagementService(_users, _roles, _unitOfWork))
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }

    private static Task<IActionResult> Invoke(UsersController controller, ManageAction action, Guid id) =>
        action switch
        {
            ManageAction.Activate => controller.Activate(id, CancellationToken.None),
            ManageAction.Deactivate => controller.Deactivate(id, CancellationToken.None),
            ManageAction.Delete => controller.Delete(id, CancellationToken.None),
            _ => throw new ArgumentOutOfRangeException(nameof(action))
        };

    private static string MessageOf(IActionResult result)
    {
        var badRequest = Assert.IsType<BadRequestObjectResult>(result);
        using var body = JsonDocument.Parse(JsonSerializer.Serialize(badRequest.Value));
        return body.RootElement.GetProperty("message").GetString()!;
    }

    [Fact]
    public async Task Activate_WithInactiveUser_ReturnsNoContentAndActivates()
    {
        var target = AddUser("jdoe", _userRole);
        target.Deactivate();

        var result = await CreateController(_admin.Username).Activate(target.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.True(target.IsActive);
        Assert.Equal(1, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task Deactivate_WithActiveUser_ReturnsNoContentAndDeactivates()
    {
        var target = AddUser("jdoe", _userRole);

        var result = await CreateController(_admin.Username).Deactivate(target.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.False(target.IsActive);
        Assert.Equal(1, _unitOfWork.SaveCalls);
    }

    [Fact]
    public async Task Delete_WithExistingUser_ReturnsNoContentAndRemoves()
    {
        var target = AddUser("jdoe", _userRole);

        var result = await CreateController(_admin.Username).Delete(target.Id, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        Assert.DoesNotContain(target, _users.Items);
        Assert.Equal(1, _unitOfWork.SaveCalls);
    }

    [Theory]
    [InlineData(ManageAction.Activate)]
    [InlineData(ManageAction.Deactivate)]
    [InlineData(ManageAction.Delete)]
    public async Task ManageAction_WithUnknownId_ReturnsNotFound(ManageAction action)
    {
        var result = await Invoke(CreateController(_admin.Username), action, Guid.NewGuid());

        Assert.IsType<NotFoundResult>(result);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Theory]
    [InlineData(ManageAction.Activate)]
    [InlineData(ManageAction.Deactivate)]
    [InlineData(ManageAction.Delete)]
    public async Task ManageAction_OnSelf_ReturnsBadRequestWithMessage(ManageAction action)
    {
        // A second admin exists, so the self rule (not the last-admin rule) is what rejects the request.
        AddUser("second-admin", _adminRole);

        var result = await Invoke(CreateController(_admin.Username), action, _admin.Id);

        Assert.Equal(new CannotModifySelfException().Message, MessageOf(result));
        Assert.True(_admin.IsActive);
        Assert.Contains(_admin, _users.Items);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Theory]
    [InlineData(ManageAction.Deactivate)]
    [InlineData(ManageAction.Delete)]
    public async Task ManageAction_OnLastActiveAdmin_ReturnsBadRequestWithMessage(ManageAction action)
    {
        var actor = AddUser("operator", _userRole);

        var result = await Invoke(CreateController(actor.Username), action, _admin.Id);

        Assert.Equal(new LastActiveAdminException().Message, MessageOf(result));
        Assert.True(_admin.IsActive);
        Assert.Contains(_admin, _users.Items);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }

    [Theory]
    [InlineData(ManageAction.Activate, null)]
    [InlineData(ManageAction.Deactivate, null)]
    [InlineData(ManageAction.Delete, null)]
    [InlineData(ManageAction.Activate, "   ")]
    [InlineData(ManageAction.Deactivate, "   ")]
    [InlineData(ManageAction.Delete, "   ")]
    public async Task ManageAction_WithoutActingUsername_ReturnsUnauthorizedWithoutCallingService(
        ManageAction action, string? actingUsername)
    {
        var target = AddUser("jdoe", _userRole);

        var result = await Invoke(CreateController(actingUsername), action, target.Id);

        Assert.IsType<UnauthorizedResult>(result);
        Assert.Equal(0, _users.FindByIdCalls);
        Assert.True(target.IsActive);
        Assert.Contains(target, _users.Items);
        Assert.Equal(0, _unitOfWork.SaveCalls);
    }
}
