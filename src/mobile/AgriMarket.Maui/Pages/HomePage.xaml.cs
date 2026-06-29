using AgriMarket.Maui.Core.Auth;

namespace AgriMarket.Maui.Pages;

public partial class HomePage : ContentPage
{
    private readonly ITokenStorage _tokenStorage;

    public string WelcomeText { get; set; } = "ยินดีต้อนรับสู่ AgriMarket";

    public HomePage(ITokenStorage tokenStorage)
    {
        InitializeComponent();
        _tokenStorage = tokenStorage;
        BindingContext = this;
    }

    private async void OnLogoutClicked(object? sender, EventArgs e)
    {
        await _tokenStorage.ClearAsync();
        await Shell.Current.GoToAsync("//login");
    }
}
