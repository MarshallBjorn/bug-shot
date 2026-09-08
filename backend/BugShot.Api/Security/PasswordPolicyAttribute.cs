using System.ComponentModel.DataAnnotations;
using System.Text;

namespace BugShot.Api.Security;

// dlugosc liczona w bajtach bo bcrypt tnie wejscie na 72 bajtach a nie na 72 znakach
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class PasswordPolicyAttribute : ValidationAttribute
{
    // wynik zamiast ustawiania ErrorMessage bo atrybut jest wspoldzielony miedzy zadaniami
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is not string password)
        {
            return Rejected("Password is required.", validationContext);
        }

        if (password.Length < PasswordHasher.MinPasswordLength)
        {
            return Rejected(
                $"Password must be at least {PasswordHasher.MinPasswordLength} characters long.",
                validationContext);
        }

        if (Encoding.UTF8.GetByteCount(password) > PasswordHasher.MaxPasswordBytes)
        {
            return Rejected(
                $"Password must not be longer than {PasswordHasher.MaxPasswordBytes} bytes.",
                validationContext);
        }

        return ValidationResult.Success;
    }

    private static ValidationResult Rejected(string message, ValidationContext context) =>
        new(message, context.MemberName is null ? null : [context.MemberName]);
}
