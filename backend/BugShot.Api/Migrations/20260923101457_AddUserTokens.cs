using System;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BugShot.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddUserTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:attachment_kind", "screenshot,user_upload,console_log")
                .Annotation("Npgsql:Enum:notification_channel_type", "email,webhook")
                .Annotation("Npgsql:Enum:notification_delivery_status", "pending,sending,sent,failed,throttled")
                .Annotation("Npgsql:Enum:notification_event_type", "ticket_created,comment_added,status_changed")
                .Annotation("Npgsql:Enum:project_role", "viewer,member,maintainer")
                .Annotation("Npgsql:Enum:ticket_status", "new,in_progress,resolved,rejected,deleted")
                .Annotation("Npgsql:Enum:user_token_purpose", "invitation,password_reset")
                .OldAnnotation("Npgsql:Enum:attachment_kind", "screenshot,user_upload,console_log")
                .OldAnnotation("Npgsql:Enum:notification_channel_type", "email,webhook")
                .OldAnnotation("Npgsql:Enum:notification_delivery_status", "pending,sending,sent,failed,throttled")
                .OldAnnotation("Npgsql:Enum:notification_event_type", "ticket_created,comment_added,status_changed")
                .OldAnnotation("Npgsql:Enum:project_role", "viewer,member,maintainer")
                .OldAnnotation("Npgsql:Enum:ticket_status", "new,in_progress,resolved,rejected,deleted");

            migrationBuilder.AlterColumn<string>(
                name: "password_hash",
                table: "users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.CreateTable(
                name: "user_tokens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    purpose = table.Column<UserTokenPurpose>(type: "user_token_purpose", nullable: false),
                    token_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_tokens", x => x.id);
                    table.ForeignKey(
                        name: "fk_user_tokens_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_user_tokens_token_hash",
                table: "user_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_tokens_user_id",
                table: "user_tokens",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "user_tokens");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:attachment_kind", "screenshot,user_upload,console_log")
                .Annotation("Npgsql:Enum:notification_channel_type", "email,webhook")
                .Annotation("Npgsql:Enum:notification_delivery_status", "pending,sending,sent,failed,throttled")
                .Annotation("Npgsql:Enum:notification_event_type", "ticket_created,comment_added,status_changed")
                .Annotation("Npgsql:Enum:project_role", "viewer,member,maintainer")
                .Annotation("Npgsql:Enum:ticket_status", "new,in_progress,resolved,rejected,deleted")
                .OldAnnotation("Npgsql:Enum:attachment_kind", "screenshot,user_upload,console_log")
                .OldAnnotation("Npgsql:Enum:notification_channel_type", "email,webhook")
                .OldAnnotation("Npgsql:Enum:notification_delivery_status", "pending,sending,sent,failed,throttled")
                .OldAnnotation("Npgsql:Enum:notification_event_type", "ticket_created,comment_added,status_changed")
                .OldAnnotation("Npgsql:Enum:project_role", "viewer,member,maintainer")
                .OldAnnotation("Npgsql:Enum:ticket_status", "new,in_progress,resolved,rejected,deleted")
                .OldAnnotation("Npgsql:Enum:user_token_purpose", "invitation,password_reset");

            migrationBuilder.AlterColumn<string>(
                name: "password_hash",
                table: "users",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);
        }
    }
}
