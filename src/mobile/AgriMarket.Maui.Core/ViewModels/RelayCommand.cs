using System;
using System.Windows.Input;

namespace AgriMarket.Maui.Core.ViewModels;

/// <summary>
/// Lightweight <see cref="ICommand" /> implementation (no external MVVM
/// toolkit dependency). Supports <see cref="RaiseCanExecuteChanged" />
/// so the view model can refresh button enabled/disabled state when
/// bound properties change.
/// </summary>
public sealed class RelayCommand : ICommand
{
    private readonly Action _execute;
    private readonly Func<bool>? _canExecute;

    public RelayCommand(Action execute, Func<bool>? canExecute = null)
    {
        _execute = execute ?? throw new ArgumentNullException(nameof(execute));
        _canExecute = canExecute;
    }

    public event EventHandler? CanExecuteChanged;

    public bool CanExecute(object? parameter) => _canExecute?.Invoke() ?? true;

    public void Execute(object? parameter) => _execute();

    public void RaiseCanExecuteChanged()
    {
        CanExecuteChanged?.Invoke(this, EventArgs.Empty);
    }
}
