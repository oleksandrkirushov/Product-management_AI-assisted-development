namespace ProductCatalog.Application.Users;

public sealed class CannotModifySelfException()
    : Exception("You cannot activate, deactivate or delete your own account.");

public sealed class LastActiveAdminException()
    : Exception("Cannot deactivate or delete the last active administrator.");
