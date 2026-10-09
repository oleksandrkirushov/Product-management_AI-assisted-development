using ProductCatalog.Domain.Entities;

namespace ProductCatalog.Application.Abstractions;

public interface IRoleRepository
{
    Task<Role?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Role?> FindByNameAsync(string name, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Role>> GetAllAsync(CancellationToken cancellationToken = default);
}
