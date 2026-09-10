using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BugShot.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDefaultEmailSanitizationRule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "sanitization_rules",
                columns: new[] { "id", "created_at", "is_enabled", "pattern", "project_id", "replacement" },
                values: new object[] { new Guid("22222222-2222-2222-2222-222222222222"), new DateTimeOffset(new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), true, "(?<![\\w.+-])[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+", null, "***" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"));
        }
    }
}
