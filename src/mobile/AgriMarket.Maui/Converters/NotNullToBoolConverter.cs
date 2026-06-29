using System.Globalization;

namespace AgriMarket.Maui.Converters;

/// <summary>
/// Returns <c>true</c> when the bound value is not null and (for
/// strings) not empty.  Used to show error labels only when text exists.
/// </summary>
public sealed class NotNullToBoolConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is null) return false;
        if (value is string s) return !string.IsNullOrWhiteSpace(s);
        return true;
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }
}
