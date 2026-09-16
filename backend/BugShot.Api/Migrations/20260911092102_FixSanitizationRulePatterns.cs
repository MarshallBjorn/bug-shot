using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BugShot.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixSanitizationRulePatterns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"),
                column: "pattern",
                value: "(?i)\"?\\b(password|passwd|pwd)\"?\\s*[:=]\\s*\"?[^\"'\\r\\n,\\s}]+\"?");

            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"),
                column: "pattern",
                value: "(?i)\"?\\b(login|username|user_name)\"?\\s*[:=]\\s*\"?[^\"'\\r\\n,\\s}]+\"?");

            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("55555555-5555-5555-5555-555555555555"),
                column: "pattern",
                value: "(?i)(\\bAuthorization\\s*:\\s*(?:Bearer|Digest)\\s+)\\S+");

            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("77777777-7777-7777-7777-777777777777"),
                column: "pattern",
                value: "(?i)\"?\\b(?:access_token|refresh_token|id_token|session_id|sessionId)\"?\\s*[:=]\\s*\"?[^\"'\\r\\n,\\s}]+\"?");

            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("88888888-8888-8888-8888-888888888888"),
                column: "pattern",
                value: "(?i)\"?\\b(?:api[_-]?key|x-api-key|client[_-]?secret|x-client-secret|api[_-]?secret)\"?\\s*[:=]\\s*\"?[^\"'\\r\\n,\\s}]+\"?");

            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("99999999-9999-9999-9999-999999999999"),
                column: "pattern",
                value: "(?i)\"?\\b(?:csrf[_-]?token|xsrf[_-]?token|x-csrf-token|x-xsrf-token)\"?\\s*[:=]\\s*\"?[^\"'\\r\\n,\\s}]+\"?");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"),
                column: "pattern",
                value: "(?i)\\b(password|passwd|pwd)\\s*[:=]\\s*\\S+");

            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"),
                column: "pattern",
                value: "(?i)\\b(login|username|user_name)\\s*[:=]\\s*\\S+");

            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("55555555-5555-5555-5555-555555555555"),
                column: "pattern",
                value: "(?i)(\\bAuthorization\\s*:\\s*Bearer\\s+)\\S+");

            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("77777777-7777-7777-7777-777777777777"),
                column: "pattern",
                value: "(?i)\\b(?:access_token|refresh_token|id_token|session_id|sessionId)\\s*[:=]\\s*\\S+");

            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("88888888-8888-8888-8888-888888888888"),
                column: "pattern",
                value: "(?i)\\b(?:api[_-]?key|x-api-key|client[_-]?secret|x-client-secret|api[_-]?secret)\\s*[:=]\\s*\\S+");

            migrationBuilder.UpdateData(
                table: "sanitization_rules",
                keyColumn: "id",
                keyValue: new Guid("99999999-9999-9999-9999-999999999999"),
                column: "pattern",
                value: "(?i)\\b(?:csrf[_-]?token|xsrf[_-]?token|x-csrf-token|x-xsrf-token)\\s*[:=]\\s*\\S+");
        }
    }
}
