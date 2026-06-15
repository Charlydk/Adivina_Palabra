using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Text.Json;
using AhorcadoPro.Backend.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace AhorcadoPro.Backend.Authentication
{
    public class SupabaseAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public SupabaseAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration) : base(options, logger, encoder)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            // Support both Authorization header (REST) and access_token query param (SignalR WebSocket)
            var token = Request.Headers.Authorization.FirstOrDefault()?.Replace("Bearer ", "")
                        ?? Request.Query["access_token"].FirstOrDefault();

            if (string.IsNullOrEmpty(token))
                return AuthenticateResult.NoResult();

            var supabaseUrl = _configuration["Supabase:Url"];
            var anonKey = _configuration["Supabase:AnonKey"];

            try
            {
                var client = _httpClientFactory.CreateClient();
                using var request = new HttpRequestMessage(HttpMethod.Get, $"{supabaseUrl}/auth/v1/user");
                request.Headers.Add("Authorization", $"Bearer {token}");
                request.Headers.Add("apikey", anonKey);

                var response = await client.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                    return AuthenticateResult.Fail("Invalid Supabase token");

                var json = await response.Content.ReadAsStringAsync();
                var user = JsonSerializer.Deserialize<SupabaseUser>(json);

                if (user == null || string.IsNullOrEmpty(user.Id))
                    return AuthenticateResult.Fail("Invalid user data");

                var username = user.UserMetadata?.TryGetValue("username", out var u) == true
                    ? u?.ToString()
                    : user.Email?.Split('@')[0];

                var claims = new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id),
                    new Claim(ClaimTypes.Email, user.Email ?? ""),
                    new Claim("username", username ?? ""),
                };

                var identity = new ClaimsIdentity(claims, Scheme.Name);
                var principal = new ClaimsPrincipal(identity);
                var ticket = new AuthenticationTicket(principal, Scheme.Name);

                return AuthenticateResult.Success(ticket);
            }
            catch (Exception ex)
            {
                Logger.LogError(ex, "Error validating Supabase token");
                return AuthenticateResult.Fail("Token validation error");
            }
        }
    }
}
