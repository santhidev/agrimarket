using AgriMarket.Maui.Core.Auth;
using AgriMarket.Maui.Core.Models;
using AgriMarket.Maui.Core.ViewModels;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Shouldly;
using Xunit;

namespace AgriMarket.Maui.Tests.ViewModels;

public class LoginViewModelTests
{
    private readonly IAuthApiService _authApi;
    private readonly ITokenStorage _tokenStorage;
    private readonly LoginViewModel _vm;

    public LoginViewModelTests()
    {
        _authApi = Substitute.For<IAuthApiService>();
        _tokenStorage = Substitute.For<ITokenStorage>();
        _vm = new LoginViewModel(_authApi, _tokenStorage);
    }

    // ── Initial state ──────────────────────────────────────────

    [Fact]
    public void InitialState_StepIsPhone()
    {
        _vm.Step.ShouldBe(LoginStep.Phone);
    }

    [Fact]
    public void InitialState_IsLoadingIsFalse()
    {
        _vm.IsLoading.ShouldBeFalse();
    }

    [Fact]
    public void InitialState_ErrorMessageIsNull()
    {
        _vm.ErrorMessage.ShouldBeNull();
    }

    [Fact]
    public void InitialState_TestCodeIsNull()
    {
        _vm.TestCode.ShouldBeNull();
    }

    [Fact]
    public void InitialState_PhoneNumberIsEmpty()
    {
        _vm.PhoneNumber.ShouldBeEmpty();
    }

    [Fact]
    public void InitialState_CodeIsEmpty()
    {
        _vm.Code.ShouldBeEmpty();
    }

    // ── Command can-execute ───────────────────────────────────

    [Fact]
    public void RequestOtpCommand_CannotExecuteWithoutPhone()
    {
        _vm.RequestOtpCommand.CanExecute(null).ShouldBeFalse();
    }

    [Fact]
    public void RequestOtpCommand_CanExecuteWithPhone()
    {
        _vm.PhoneNumber = "0812345678";
        _vm.RequestOtpCommand.CanExecute(null).ShouldBeTrue();
    }

    [Fact]
    public void VerifyOtpCommand_CannotExecuteWithoutCode()
    {
        _vm.Code = string.Empty;
        _vm.VerifyOtpCommand.CanExecute(null).ShouldBeFalse();
    }

    [Fact]
    public void VerifyOtpCommand_CanExecuteWithCode()
    {
        _vm.Code = "123456";
        _vm.VerifyOtpCommand.CanExecute(null).ShouldBeTrue();
    }

    // ── RequestOtp success ────────────────────────────────────

    [Fact]
    public async Task RequestOtp_Success_MovesToOtpStep()
    {
        // Arrange
        _vm.PhoneNumber = "0812345678";
        _authApi.RequestOtpAsync("0812345678", Arg.Any<CancellationToken>())
                .Returns(new RequestOtpResponse { ExpiresIn = 300, TestCode = "000000" });

        // Act
        _vm.RequestOtpCommand.Execute(null);
        await Task.Yield();

        // Assert
        _vm.Step.ShouldBe(LoginStep.Otp);
    }

    [Fact]
    public async Task RequestOtp_Success_SetsTestCode()
    {
        _vm.PhoneNumber = "0812345678";
        _authApi.RequestOtpAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                .Returns(new RequestOtpResponse { ExpiresIn = 300, TestCode = "000000" });

        _vm.RequestOtpCommand.Execute(null);
        await Task.Yield();

        _vm.TestCode.ShouldBe("000000");
    }

    [Fact]
    public async Task RequestOtp_Success_SetsExpiresInSeconds()
    {
        _vm.PhoneNumber = "0812345678";
        _authApi.RequestOtpAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                .Returns(new RequestOtpResponse { ExpiresIn = 300, TestCode = "000000" });

        _vm.RequestOtpCommand.Execute(null);
        await Task.Yield();

        _vm.ExpiresInSeconds.ShouldBe(300);
    }

    [Fact]
    public async Task RequestOtp_Success_IsLoadingIsFalse()
    {
        _vm.PhoneNumber = "0812345678";
        _authApi.RequestOtpAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                .Returns(new RequestOtpResponse { ExpiresIn = 300, TestCode = "000000" });

        _vm.RequestOtpCommand.Execute(null);
        await Task.Yield();

        _vm.IsLoading.ShouldBeFalse();
    }

    // ── RequestOtp failure ────────────────────────────────────

    [Fact]
    public async Task RequestOtp_Failure_SetsErrorMessage()
    {
        _vm.PhoneNumber = "0812345678";
        _authApi.RequestOtpAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                .ThrowsAsync(new InvalidOperationException("Network error"));

        _vm.RequestOtpCommand.Execute(null);
        await Task.Yield();

        _vm.ErrorMessage.ShouldBe("Network error");
    }

    [Fact]
    public async Task RequestOtp_Failure_StaysOnPhoneStep()
    {
        _vm.PhoneNumber = "0812345678";
        _authApi.RequestOtpAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                .ThrowsAsync(new InvalidOperationException("Network error"));

        _vm.RequestOtpCommand.Execute(null);
        await Task.Yield();

        _vm.Step.ShouldBe(LoginStep.Phone);
    }

    [Fact]
    public async Task RequestOtp_Failure_IsLoadingIsFalse()
    {
        _vm.PhoneNumber = "0812345678";
        _authApi.RequestOtpAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                .ThrowsAsync(new InvalidOperationException("Network error"));

        _vm.RequestOtpCommand.Execute(null);
        await Task.Yield();

        _vm.IsLoading.ShouldBeFalse();
    }

    // ── VerifyOtp success ─────────────────────────────────────

    [Fact]
    public async Task VerifyOtp_Success_SavesTokenToStorage()
    {
        var accessToken = "jwt-token-abc123";
        _vm.PhoneNumber = "0812345678";
        _vm.Code = "000000";
        _authApi.VerifyOtpAsync(Arg.Any<string>(), Arg.Any<string>(), null, Arg.Any<CancellationToken>())
                .Returns(new VerifyOtpResponse
                {
                    AccessToken = accessToken,
                    ExpiresIn = 3600,
                    User = new CurrentUserDto
                    {
                        Id = Guid.NewGuid(),
                        UserName = "farmer01",
                        PhoneNumber = "0812345678"
                    }
                });

        _vm.VerifyOtpCommand.Execute(null);
        await Task.Yield();

        await _tokenStorage.Received(1).SetAccessTokenAsync(accessToken);
    }

    [Fact]
    public async Task VerifyOtp_Success_RaisesLoginSucceededEvent()
    {
        var accessToken = "jwt-token-abc123";
        var userName = "farmer01";
        _vm.PhoneNumber = "0812345678";
        _vm.Code = "000000";
        _authApi.VerifyOtpAsync(Arg.Any<string>(), Arg.Any<string>(), null, Arg.Any<CancellationToken>())
                .Returns(new VerifyOtpResponse
                {
                    AccessToken = accessToken,
                    ExpiresIn = 3600,
                    User = new CurrentUserDto
                    {
                        Id = Guid.NewGuid(),
                        UserName = userName,
                        PhoneNumber = "0812345678"
                    }
                });

        LoginSucceededEventArgs? eventArgs = null;
        _vm.LoginSucceeded += (_, e) => eventArgs = e;

        _vm.VerifyOtpCommand.Execute(null);
        await Task.Yield();

        eventArgs.ShouldNotBeNull();
        eventArgs.UserName.ShouldBe(userName);
        eventArgs.AccessToken.ShouldBe(accessToken);
    }

    // ── VerifyOtp failure ─────────────────────────────────────

    [Fact]
    public async Task VerifyOtp_Failure_SetsErrorMessage()
    {
        _vm.PhoneNumber = "0812345678";
        _vm.Code = "wrong";
        _authApi.VerifyOtpAsync(Arg.Any<string>(), Arg.Any<string>(), null, Arg.Any<CancellationToken>())
                .ThrowsAsync(new InvalidOperationException("Invalid code"));

        _vm.VerifyOtpCommand.Execute(null);
        await Task.Yield();

        _vm.ErrorMessage.ShouldBe("Invalid code");
    }

    [Fact]
    public async Task VerifyOtp_Failure_DoesNotSaveToken()
    {
        _vm.PhoneNumber = "0812345678";
        _vm.Code = "wrong";
        _authApi.VerifyOtpAsync(Arg.Any<string>(), Arg.Any<string>(), null, Arg.Any<CancellationToken>())
                .ThrowsAsync(new InvalidOperationException("Invalid code"));

        _vm.VerifyOtpCommand.Execute(null);
        await Task.Yield();

        await _tokenStorage.DidNotReceive().SetAccessTokenAsync(Arg.Any<string>());
    }

    // ── BackToPhone ───────────────────────────────────────────

    [Fact]
    public async Task BackToPhone_ResetsToPhoneStep()
    {
        // First navigate to OTP step
        _vm.PhoneNumber = "0812345678";
        _authApi.RequestOtpAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                .Returns(new RequestOtpResponse { ExpiresIn = 300, TestCode = "000000" });
        _vm.RequestOtpCommand.Execute(null);
        await Task.Yield();
        _vm.Step.ShouldBe(LoginStep.Otp);

        // Now go back
        _vm.BackToPhoneCommand.Execute(null);

        _vm.Step.ShouldBe(LoginStep.Phone);
    }

    [Fact]
    public async Task BackToPhone_ClearsCode()
    {
        _vm.PhoneNumber = "0812345678";
        _vm.Code = "123456";
        _authApi.RequestOtpAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                .Returns(new RequestOtpResponse { ExpiresIn = 300, TestCode = "000000" });
        _vm.RequestOtpCommand.Execute(null);
        await Task.Yield();
        _vm.Step.ShouldBe(LoginStep.Otp);

        _vm.BackToPhoneCommand.Execute(null);

        _vm.Code.ShouldBeEmpty();
    }

    [Fact]
    public async Task BackToPhone_ClearsTestCode()
    {
        _vm.PhoneNumber = "0812345678";
        _authApi.RequestOtpAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                .Returns(new RequestOtpResponse { ExpiresIn = 300, TestCode = "000000" });
        _vm.RequestOtpCommand.Execute(null);
        await Task.Yield();
        _vm.TestCode.ShouldBe("000000");

        _vm.BackToPhoneCommand.Execute(null);

        _vm.TestCode.ShouldBeNull();
    }

    [Fact]
    public async Task BackToPhone_ClearsErrorMessage()
    {
        // Trigger an error first via a failed request-otp
        _vm.PhoneNumber = "0812345678";
        _authApi.RequestOtpAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
                .ThrowsAsync(new InvalidOperationException("Server error"));
        _vm.RequestOtpCommand.Execute(null);
        await Task.Yield();
        _vm.ErrorMessage.ShouldNotBeNull();

        // Now go back – should clear the error
        _vm.BackToPhoneCommand.Execute(null);

        _vm.ErrorMessage.ShouldBeNull();
    }

    // ── Constructor validation ────────────────────────────────

    [Fact]
    public void Constructor_NullAuthApi_ThrowsArgumentNullException()
    {
        Should.Throw<ArgumentNullException>(() =>
            new LoginViewModel(null!, _tokenStorage));
    }

    [Fact]
    public void Constructor_NullTokenStorage_ThrowsArgumentNullException()
    {
        Should.Throw<ArgumentNullException>(() =>
            new LoginViewModel(_authApi, null!));
    }
}
