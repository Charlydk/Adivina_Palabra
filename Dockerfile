FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY backend/AhorcadoPro.Backend/AhorcadoPro.Backend.csproj backend/AhorcadoPro.Backend/
RUN dotnet restore backend/AhorcadoPro.Backend/AhorcadoPro.Backend.csproj
COPY backend/AhorcadoPro.Backend/ backend/AhorcadoPro.Backend/
WORKDIR /src/backend/AhorcadoPro.Backend
RUN dotnet publish AhorcadoPro.Backend.csproj -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "AhorcadoPro.Backend.dll"]
