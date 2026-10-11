using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductCatalog.Application.Authorization;
using ProductCatalog.Application.Users;

namespace ProductCatalog.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public sealed class UsersController(
    UserProfileService userProfileService,
    UserManagementService userManagementService
    ) : ControllerBase
{
    [HttpGet("me")]
    [ProducesResponseType<UserProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserProfileResponse>> Me(CancellationToken cancellationToken)
    {
        var username = User.Identity?.Name;
        if (string.IsNullOrWhiteSpace(username))
            return Unauthorized();

        var profile = await userProfileService.GetByUsernameAsync(username, cancellationToken);
        return profile is null ? NotFound() : Ok(profile);
    }

    [HttpGet]
    [Authorize(Policy = Permissions.UsersRead)]
    [ProducesResponseType<IReadOnlyList<UserProfileResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<UserProfileResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var users = await userProfileService.GetAllAsync(cancellationToken);
        return Ok(users);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Permissions.UsersRead)]
    [ProducesResponseType<UserProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserProfileResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var profile = await userProfileService.GetByIdAsync(id, cancellationToken);
        return profile is null ? NotFound() : Ok(profile);
    }

    [HttpPatch("{id:guid}/activate")]
    [Authorize(Policy = Permissions.UsersManage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> Activate(Guid id, CancellationToken cancellationToken) =>
        ManageAsync(actingUsername => userManagementService.ActivateAsync(id, actingUsername, cancellationToken));

    [HttpPatch("{id:guid}/deactivate")]
    [Authorize(Policy = Permissions.UsersManage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken) =>
        ManageAsync(actingUsername => userManagementService.DeactivateAsync(id, actingUsername, cancellationToken));

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Permissions.UsersManage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        ManageAsync(actingUsername => userManagementService.DeleteAsync(id, actingUsername, cancellationToken));

    // Shared flow of the management actions: resolve the acting user from the token, run the operation
    // and translate the service outcome (not found / business-rule violation) into an HTTP status.
    private async Task<IActionResult> ManageAsync(Func<string, Task<bool>> operation)
    {
        var actingUsername = User.Identity?.Name;
        if (string.IsNullOrWhiteSpace(actingUsername))
            return Unauthorized();

        try
        {
            return await operation(actingUsername) ? NoContent() : NotFound();
        }
        catch (CannotModifySelfException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (LastActiveAdminException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
