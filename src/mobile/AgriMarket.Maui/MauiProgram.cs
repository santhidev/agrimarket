using System.Reflection;
using System.Text.Json;
using AgriMarket.Maui.Auth;
using AgriMarket.Maui.Core.Auth;
using AgriMarket.Maui.Core.ViewModels;
using AgriMarket.Maui.Pages;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AgriMarket.Maui;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

        // Load embedded appsettings.json for the API base URL.
        var apiBaseUrl = LoadApiBaseUrl();
        if (!apiBaseUrl.EndsWith('/'))
            apiBaseUrl += '/';

        // ── Auth services ──────────────────────────────────────────

        // Token storage: SecureStorage (Android Keystore / Windows DPAPI).
        builder.Services.AddSingleton<ITokenStorage, SecureStorageTokenStorage>();

        // HTTP handler that attaches the JWT bearer token.
        builder.Services.AddTransient<AuthenticatingHttpMessageHandler>();

        // HttpClient factory: builds a handler chain that bypasses
        // self-signed cert validation (dev HTTPS) and attaches the JWT.
        builder.Services.AddSingleton<HttpClient>(sp =>
        {
            var tokenHandler = sp.GetRequiredService<AuthenticatingHttpMessageHandler>();
            var primaryHandler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = (_, _, _, _) => true
            };
            tokenHandler.InnerHandler = primaryHandler;
            return new HttpClient(tokenHandler)
            {
                BaseAddress = new Uri(apiBaseUrl)
            };
        });

        // Auth API service uses the configured HttpClient.
        builder.Services.AddTransient<IAuthApiService, AuthApiService>();

        // ── View models ────────────────────────────────────────────

        builder.Services.AddTransient<LoginViewModel>();

        // ── Pages ──────────────────────────────────────────────────

        builder.Services.AddTransient<LoginPage>();
        builder.Services.AddTransient<HomePage>();

        // ── App ────────────────────────────────────────────────────

        builder.Services.AddSingleton<App>();
        builder.Services.AddSingleton<AppShell>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }

    /// <summary>
    /// Reads the API base URL from the embedded <c>appsettings.json</c>.
    /// Android emulator uses <c>10.0.2.2</c> (maps to host localhost);
    /// Windows desktop uses <c>localhost</c>.
    /// </summary>
    private static string LoadApiBaseUrl()
    {
        try
        {
            var assembly = Assembly.GetExecutingAssembly();
            using var stream = assembly.GetManifestResourceStream("AgriMarket.Maui.appsettings.json");
            if (stream is null) return "https://localhost:44305/";

            using var reader = new StreamReader(stream);
            var json = reader.ReadToEnd();
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("Api", out var api)
                && api.TryGetProperty("BaseUrl", out var url))
            {
                return url.GetString() ?? "https://localhost:44305/";
            }
        }
        catch
        {
            // Fall back to default if settings can't be read.
        }

        return "https://localhost:44305/";
    }
}
