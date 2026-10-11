using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using ProductCatalog.Api.Authentication;
using ProductCatalog.Api.Authorization;
using ProductCatalog.Api.Contracts;
using ProductCatalog.Api.Options;
using ProductCatalog.Application.Auth;
using ProductCatalog.Application.Users;

namespace ProductCatalog.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    AuthService authService,
    RegisterUserService registerUserService,
    IOptions<JwtOptions> jwtOptions
    ) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var authenticatedUser = await authService.AuthenticateAsync(
            request.Username, request.Password, cancellationToken);
        if (authenticatedUser is null)
            return Unauthorized(new { message = "Invalid username or password." });

        var options = jwtOptions.Value;
        var expiresAt = DateTime.UtcNow.AddMinutes(options.ExpirationMinutes);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, authenticatedUser.Username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ActiveUserTokenValidator.UserIdClaimType, authenticatedUser.Id.ToString()),
            new Claim(ClaimTypes.Name, authenticatedUser.Username),
            new Claim(ClaimTypes.Email, authenticatedUser.Email),
            new Claim(ClaimTypes.Role, authenticatedUser.RoleName),
            new Claim(PermissionAuthorizationHandler.PermissionsClaimType, JsonSerializer.Serialize(authenticatedUser.Permissions))
        };
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            options.Issuer, options.Audience, claims, expires: expiresAt, signingCredentials: credentials);

        return Ok(new
        {
            accessToken = new JwtSecurityTokenHandler().WriteToken(token),
            tokenType = "Bearer",
            expiresAtUtc = expiresAt
        });
    }

    [AllowAnonymous]
    [HttpPost("register")]
    [ProducesResponseType<CreateUserResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<CreateUserResponse>> Register(
        RegisterRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await registerUserService.RegisterAsync(
                new RegisterUserCommand(
                    request.Username, request.Email, request.FirstName, request.LastName, request.Password),
                cancellationToken);
            return CreatedAtAction(
                nameof(UsersController.GetById), "Users", new { id = response.Id }, response);
        }
        catch (DuplicateUsernameException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (DuplicateEmailException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
