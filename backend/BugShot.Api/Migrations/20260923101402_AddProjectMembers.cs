using System;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BugShot.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectMembers : Migration
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
                .OldAnnotation("Npgsql:Enum:attachment_kind", "screenshot,user_upload,console_log")
                .OldAnnotation("Npgsql:Enum:notification_channel_type", "email,webhook")
                .OldAnnotation("Npgsql:Enum:notification_delivery_status", "pending,sending,sent,failed,throttled")
                .OldAnnotation("Npgsql:Enum:notification_event_type", "ticket_created,comment_added,status_changed")
                .OldAnnotation("Npgsql:Enum:ticket_status", "new,in_progress,resolved,rejected,deleted");

            migrationBuilder.CreateTable(
                name: "project_members",
                columns: table => new
                {
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<ProjectRole>(type: "project_role", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_project_members", x => new { x.project_id, x.user_id });
                    table.ForeignKey(
                        name: "fk_project_members_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_project_members_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_project_members_user_id",
                table: "project_members",
                column: "user_id");

            // do tej pory kazde konto widzialo kazdy projekt i obrabialo zgloszenia
            // wiec zwykle konta dostaja member wszedzie zeby wdrozenie nikomu nie odebralo dostepu
            migrationBuilder.Sql("""
                insert into project_members (project_id, user_id, role, created_at)
                select p.id, u.id, 'member', now()
                from projects p
                cross join users u
                where not u.is_admin;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "project_members");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:attachment_kind", "screenshot,user_upload,console_log")
                .Annotation("Npgsql:Enum:notification_channel_type", "email,webhook")
                .Annotation("Npgsql:Enum:notification_delivery_status", "pending,sending,sent,failed,throttled")
                .Annotation("Npgsql:Enum:notification_event_type", "ticket_created,comment_added,status_changed")
                .Annotation("Npgsql:Enum:ticket_status", "new,in_progress,resolved,rejected,deleted")
                .OldAnnotation("Npgsql:Enum:attachment_kind", "screenshot,user_upload,console_log")
                .OldAnnotation("Npgsql:Enum:notification_channel_type", "email,webhook")
                .OldAnnotation("Npgsql:Enum:notification_delivery_status", "pending,sending,sent,failed,throttled")
                .OldAnnotation("Npgsql:Enum:notification_event_type", "ticket_created,comment_added,status_changed")
                .OldAnnotation("Npgsql:Enum:project_role", "viewer,member,maintainer")
                .OldAnnotation("Npgsql:Enum:ticket_status", "new,in_progress,resolved,rejected,deleted");
        }
    }
}
