using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Input;
using AgriMarket.Maui.Core.Auth;

namespace AgriMarket.Maui.Core.ViewModels;

/// <summary>
/// Two-step phone-OTP login flow for the MAUI app (mirrors the Blazor
/// <c>Login.razor</c>).  The view model delegates all network calls to
/// <see cref="IAuthApiService" /> and token persistence to
/// <see cref="ITokenStorage" />, making it fully unit-testable.
/// </summary>
public sealed class LoginViewModel : ViewModelBase
{
    private readonly IAuthApiService _authApi;
    private readonly ITokenStorage _tokenStorage;

    private LoginStep _step = LoginStep.Phone;
    private string _phoneNumber = string.Empty;
    private string _code = string.Empty;
    private bool _isLoading;
    private string? _errorMessage;
    private string? _testCode;
    private int _expiresInSeconds;

    public LoginViewModel(IAuthApiService authApi, ITokenStorage tokenStorage)
    {
        _authApi = authApi ?? throw new ArgumentNullException(nameof(authApi));
        _tokenStorage = tokenStorage ?? throw new ArgumentNullException(nameof(tokenStorage));

        RequestOtpCommand = new RelayCommand(RequestOtp, () => !IsLoading && !string.IsNullOrWhiteSpace(PhoneNumber));
        VerifyOtpCommand = new RelayCommand(VerifyOtp, () => !IsLoading && !string.IsNullOrWhiteSpace(Code));
        BackToPhoneCommand = new RelayCommand(BackToPhone, () => !IsLoading);
    }

    // ── Bound properties ──────────────────────────────────────────

    public LoginStep Step
    {
        get => _step;
        private set
        {
            if (SetProperty(ref _step, value))
                RaiseCanExecuteChanged();
        }
    }

    public string PhoneNumber
    {
        get => _phoneNumber;
        set
        {
            if (SetProperty(ref _phoneNumber, value))
                RequestOtpCommand.RaiseCanExecuteChanged();
        }
    }

    public string Code
    {
        get => _code;
        set
        {
            if (SetProperty(ref _code, value))
                VerifyOtpCommand.RaiseCanExecuteChanged();
        }
    }

    public bool IsLoading
    {
        get => _isLoading;
        private set
        {
            if (SetProperty(ref _isLoading, value))
                RaiseCanExecuteChanged();
        }
    }

    public string? ErrorMessage
    {
        get => _errorMessage;
        private set => SetProperty(ref _errorMessage, value);
    }

    /// <summary>OTP displayed in test mode (dev only). Null in production.</summary>
    public string? TestCode
    {
        get => _testCode;
        private set => SetProperty(ref _testCode, value);
    }

    public int ExpiresInSeconds
    {
        get => _expiresInSeconds;
        private set => SetProperty(ref _expiresInSeconds, value);
    }

    // ── Commands ──────────────────────────────────────────────────

    public RelayCommand RequestOtpCommand { get; }
    public RelayCommand VerifyOtpCommand { get; }
    public RelayCommand BackToPhoneCommand { get; }

    // ── Events ────────────────────────────────────────────────────

    /// <summary>Raised on successful verify-otp so the page can navigate.</summary>
    public event EventHandler<LoginSucceededEventArgs>? LoginSucceeded;

    // ── Flow ──────────────────────────────────────────────────────

    private async void RequestOtp()
    {
        IsLoading = true;
        ErrorMessage = null;

        try
        {
            var result = await _authApi.RequestOtpAsync(PhoneNumber.Trim());
            ExpiresInSeconds = result.ExpiresIn;
            TestCode = result.TestCode; // null in prod
            Step = LoginStep.Otp;
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsLoading = false;
        }
    }

    private async void VerifyOtp()
    {
        IsLoading = true;
        ErrorMessage = null;

        try
        {
            var result = await _authApi.VerifyOtpAsync(PhoneNumber.Trim(), Code.Trim());
            await _tokenStorage.SetAccessTokenAsync(result.AccessToken);
            LoginSucceeded?.Invoke(this, new LoginSucceededEventArgs(result.User.UserName, result.AccessToken));
        }
        catch (Exception ex)
        {
            ErrorMessage = ex.Message;
        }
        finally
        {
            IsLoading = false;
        }
    }

    private void BackToPhone()
    {
        Step = LoginStep.Phone;
        Code = string.Empty;
        TestCode = null;
        ErrorMessage = null;
    }

    private void RaiseCanExecuteChanged()
    {
        RequestOtpCommand.RaiseCanExecuteChanged();
        VerifyOtpCommand.RaiseCanExecuteChanged();
        BackToPhoneCommand.RaiseCanExecuteChanged();
    }
}

public enum LoginStep
{
    Phone,
    Otp
}

public sealed class LoginSucceededEventArgs : EventArgs
{
    public string UserName { get; }
    public string AccessToken { get; }

    public LoginSucceededEventArgs(string userName, string accessToken)
    {
        UserName = userName;
        AccessToken = accessToken;
    }
}
