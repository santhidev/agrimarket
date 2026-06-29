using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace AgriMarket.Maui.Core.ViewModels;

/// <summary>
/// Minimal <see cref="INotifyPropertyChanged" /> base for view models.
/// Keeps the Core library free of any MAUI / UI framework dependency
/// so it can be unit-tested in a plain <c>net10.0</c> project.
/// </summary>
public abstract class ViewModelBase : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    /// <summary>Sets the field and raises <see cref="PropertyChanged" /> if the value changed.</summary>
    protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value))
            return false;

        field = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
