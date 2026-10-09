using Microsoft.EntityFrameworkCore;
using ProductCatalog.Application.Abstractions;
using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Infrastructure.Persistence;

internal sealed class RoleRepository(AppDbContext dbContext) : IRoleRepository
{
    public Task<Role?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Roles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

    public Task<Role?> FindByNameAsync(string name, CancellationToken cancellationToken = default) =>
        dbContext.Roles.AsNoTracking().SingleOrDefaultAsync(x => x.Name == name, cancellationToken);

    public async Task<IReadOnlyList<Role>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await dbContext.Roles.AsNoTracking().ToListAsync(cancellationToken);
}
