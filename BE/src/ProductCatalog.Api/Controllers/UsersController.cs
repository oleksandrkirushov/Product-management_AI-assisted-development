using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductCatalog.Application.Users;

namespace ProductCatalog.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public sealed class UsersController(UserProfileService userProfileService) : ControllerBase
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
    [Authorize(Roles = "Admin")]
    [ProducesResponseType<IReadOnlyList<UserProfileResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<UserProfileResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var users = await userProfileService.GetAllAsync(cancellationToken);
        return Ok(users);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType<UserProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserProfileResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var profile = await userProfileService.GetByIdAsync(id, cancellationToken);
        return profile is null ? NotFound() : Ok(profile);
    }
}
