FROM mcr.microsoft.com/dotnet/sdk:8.0
WORKDIR /app
COPY *.csproj ./
RUN dotnet restore
COPY . .
CMD ["dotnet", "run", "--urls", "http://0.0.0.0:8080"]