FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ProductCatalog.sln ./
COPY src/ProductCatalog.Domain/ProductCatalog.Domain.csproj src/ProductCatalog.Domain/
COPY src/ProductCatalog.Application/ProductCatalog.Application.csproj src/ProductCatalog.Application/
COPY src/ProductCatalog.Infrastructure/ProductCatalog.Infrastructure.csproj src/ProductCatalog.Infrastructure/
COPY src/ProductCatalog.Api/ProductCatalog.Api.csproj src/ProductCatalog.Api/
COPY tests/ProductCatalog.UnitTests/ProductCatalog.UnitTests.csproj tests/ProductCatalog.UnitTests/
RUN dotnet restore ProductCatalog.sln
COPY . .
RUN dotnet publish src/ProductCatalog.Api/ProductCatalog.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ProductCatalog.Api.dll"]
