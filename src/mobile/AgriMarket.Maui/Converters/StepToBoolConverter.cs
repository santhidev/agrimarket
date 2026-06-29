using System.Globalization;
using AgriMarket.Maui.Core.ViewModels;

namespace AgriMarket.Maui.Converters;

/// <summary>
/// Returns <c>true</c> when the bound <see cref="LoginStep" /> matches
/// the <c>ConverterParameter</c> string ("Phone" or "Otp").  Used to
/// toggle visibility of the phone / OTP panels.
/// </summary>
public sealed class StepToBoolConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (value is LoginStep step && parameter is string target)
        {
            return string.Equals(step.ToString(), target, StringComparison.OrdinalIgnoreCase);
        }
        return false;
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }
}
