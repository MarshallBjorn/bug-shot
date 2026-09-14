using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace BugShot.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCredentialSanitizationRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "sanitization_rules",
                columns: new[] { "id", "created_at", "is_enabled", "pattern", "project_id", "replacement" },
                values: new object[,]
                {
                    { new Guid("33333333-3333-3333-3333-333333333333"), new DateTimeOffset(new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "(?i)\\b(password|passwd|pwd)\\s*[:=]\\s*\\S+", null, "***" },
                    { new Guid("44444444-4444-4444-4444-444444444444"), new DateTimeOffset(new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "(?i)\\b(login|username|user_name)\\s*[:=]\\s*\\S+", null, "***" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"));

            migrationBuilder.DeleteData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"));
        }
    }
}
