using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace BugShot.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExtendedSensitiveSanitizationRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "sanitization_rules",
                columns: new[] { "id", "created_at", "is_enabled", "pattern", "project_id", "replacement" },
                values: new object[,]
                {
                    { new Guid("55555555-5555-5555-5555-555555555555"), new DateTimeOffset(new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "(?i)(\\bAuthorization\\s*:\\s*Bearer\\s+)\\S+", null, "$1***" },
                    { new Guid("66666666-6666-6666-6666-666666666666"), new DateTimeOffset(new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "(?i)(\\bAuthorization\\s*:\\s*Basic\\s+)\\S+", null, "$1***" },
                    { new Guid("77777777-7777-7777-7777-777777777777"), new DateTimeOffset(new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "(?i)\\b(?:access_token|refresh_token|id_token|session_id|sessionId)\\s*[:=]\\s*\\S+", null, "***" },
                    { new Guid("88888888-8888-8888-8888-888888888888"), new DateTimeOffset(new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "(?i)\\b(?:api[_-]?key|x-api-key|client[_-]?secret|x-client-secret|api[_-]?secret)\\s*[:=]\\s*\\S+", null, "***" },
                    { new Guid("99999999-9999-9999-9999-999999999999"), new DateTimeOffset(new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "(?i)\\b(?:csrf[_-]?token|xsrf[_-]?token|x-csrf-token|x-xsrf-token)\\s*[:=]\\s*\\S+", null, "***" },
                    { new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), new DateTimeOffset(new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "(?i)(\\bCookie\\s*:\\s*)[^\\r\\n]+", null, "$1***" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("55555555-5555-5555-5555-555555555555"));

            migrationBuilder.DeleteData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("66666666-6666-6666-6666-666666666666"));

            migrationBuilder.DeleteData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("77777777-7777-7777-7777-777777777777"));

            migrationBuilder.DeleteData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("88888888-8888-8888-8888-888888888888"));

            migrationBuilder.DeleteData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("99999999-9999-9999-9999-999999999999"));

            migrationBuilder.DeleteData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"));
        }
    }
}
