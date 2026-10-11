using Microsoft.EntityFrameworkCore;
using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Infrastructure.Persistence;

internal sealed class UserRepository(AppDbContext dbContext) : IUserRepository
{
    public async Task AddAsync(User user, CancellationToken cancellationToken = default) =>
        await dbContext.Users.AddAsync(user, cancellationToken);

    public Task<User?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<User?> FindByUsernameAsync(string username, CancellationToken cancellationToken = default) =>
        dbContext.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Username == username, cancellationToken);

    public Task<User?> FindByEmailAsync(string email, CancellationToken cancellationToken = default) =>
        dbContext.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Email == email, cancellationToken);

    public async Task<IReadOnlyList<User>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Users.AsNoTracking().ToListAsync(cancellationToken);

    public Task<int> CountActiveByRoleIdsAsync(
        IReadOnlyCollection<Guid> roleIds,
        CancellationToken cancellationToken = default) =>
        dbContext.Users.AsNoTracking().CountAsync(x => x.IsActive && roleIds.Contains(x.RoleId), cancellationToken);

    public void Update(User user) =>
        dbContext.Users.Update(user);

    public void Remove(User user) =>
        dbContext.Users.Remove(user);
}
