using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BugShot.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateNotificationDefaultTemplateSubjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "notification_templates",
                keyColumn: "id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000001"),
                column: "subject",
                value: "[{{project.name}}] New ticket {{ticket.id}}");

            migrationBuilder.UpdateData(
                table: "notification_templates",
                keyColumn: "id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000003"),
                column: "subject",
                value: "[{{project.name}}] New comment on {{ticket.id}}");

            migrationBuilder.UpdateData(
                table: "notification_templates",
                keyColumn: "id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000005"),
                column: "subject",
                value: "[{{project.name}}] Status changed for {{ticket.id}}");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "notification_templates",
                keyColumn: "id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000001"),
                column: "subject",
                value: "New ticket {{ticket.id}}");

            migrationBuilder.UpdateData(
                table: "notification_templates",
                keyColumn: "id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000003"),
                column: "subject",
                value: "New comment on {{ticket.id}}");

            migrationBuilder.UpdateData(
                table: "notification_templates",
                keyColumn: "id",
                keyValue: new Guid("10000000-0000-0000-0000-000000000005"),
                column: "subject",
                value: "Status changed for {{ticket.id}}");
        }
    }
}
