using AgriMarket.Maui.Core.Auth;

namespace AgriMarket.Maui;

public partial class App : Application
{
    private readonly ITokenStorage _tokenStorage;

    public App(ITokenStorage tokenStorage)
    {
        InitializeComponent();
        _tokenStorage = tokenStorage;
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        var window = new Window(new AppShell());

        // If a token is already stored (persisted from a previous login),
        // navigate directly to the home page.
        _ = NavigateAfterCheckAsync(window);

        return window;
    }

    private async Task NavigateAfterCheckAsync(Window window)
    {
        // Wait for the shell to be ready.
        await Task.Delay(100);

        var token = await _tokenStorage.GetAccessTokenAsync();
        if (!string.IsNullOrEmpty(token))
        {
            await MainThread.InvokeOnMainThreadAsync(async () =>
            {
                await Shell.Current.GoToAsync("//home");
            });
        }
    }
}
