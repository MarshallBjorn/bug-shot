using System;
using BugShot.Api.Models;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace BugShot.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:attachment_kind", "screenshot,user_upload,console_log")
                .Annotation("Npgsql:Enum:notification_channel_type", "email,webhook")
                .Annotation("Npgsql:Enum:notification_delivery_status", "pending,sending,sent,failed,throttled")
                .Annotation("Npgsql:Enum:notification_event_type", "ticket_created,comment_added,status_changed")
                .Annotation("Npgsql:Enum:ticket_status", "new,in_progress,resolved,rejected,deleted")
                .OldAnnotation("Npgsql:Enum:attachment_kind", "screenshot,user_upload,console_log")
                .OldAnnotation("Npgsql:Enum:ticket_status", "new,in_progress,resolved,rejected,deleted");

            migrationBuilder.CreateTable(
                name: "notification_channels",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<NotificationChannelType>(type: "notification_channel_type", nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    email_address = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    webhook_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    webhook_secret = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    throttle_window_seconds = table.Column<int>(type: "integer", nullable: true),
                    throttle_max_events = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification_channels", x => x.id);
                    table.ForeignKey(
                        name: "fk_notification_channels_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "notification_templates",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: true),
                    event_type = table.Column<NotificationEventType>(type: "notification_event_type", nullable: false),
                    channel_type = table.Column<NotificationChannelType>(type: "notification_channel_type", nullable: false),
                    subject = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    body = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification_templates", x => x.id);
                    table.ForeignKey(
                        name: "fk_notification_templates_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "notification_deliveries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    project_id = table.Column<Guid>(type: "uuid", nullable: false),
                    channel_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ticket_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_type = table.Column<NotificationEventType>(type: "notification_event_type", nullable: false),
                    rendered_subject = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    rendered_body = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: false),
                    status = table.Column<NotificationDeliveryStatus>(type: "notification_delivery_status", nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false),
                    next_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    sent_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notification_deliveries", x => x.id);
                    table.ForeignKey(
                        name: "fk_notification_deliveries_notification_channels_channel_id",
                        column: x => x.channel_id,
                        principalTable: "notification_channels",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_notification_deliveries_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_notification_deliveries_tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalTable: "tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "notification_templates",
                columns: new[] { "id", "body", "channel_type", "created_at", "event_type", "project_id", "subject" },
                values: new object[,]
                {
                    { new Guid("10000000-0000-0000-0000-000000000001"), "{{ticket.description}}", NotificationChannelType.Email, new DateTimeOffset(new DateTime(2026, 9, 15, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), NotificationEventType.TicketCreated, null, "New ticket {{ticket.id}}" },
                    { new Guid("10000000-0000-0000-0000-000000000002"), "{{ticket.description}}", NotificationChannelType.Webhook, new DateTimeOffset(new DateTime(2026, 9, 15, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), NotificationEventType.TicketCreated, null, null },
                    { new Guid("10000000-0000-0000-0000-000000000003"), "{{comment.author}}: {{comment.body}}", NotificationChannelType.Email, new DateTimeOffset(new DateTime(2026, 9, 15, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), NotificationEventType.CommentAdded, null, "New comment on {{ticket.id}}" },
                    { new Guid("10000000-0000-0000-0000-000000000004"), "{{comment.author}}: {{comment.body}}", NotificationChannelType.Webhook, new DateTimeOffset(new DateTime(2026, 9, 15, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), NotificationEventType.CommentAdded, null, null },
                    { new Guid("10000000-0000-0000-0000-000000000005"), "{{status.from}} -> {{status.to}}", NotificationChannelType.Email, new DateTimeOffset(new DateTime(2026, 9, 15, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), NotificationEventType.StatusChanged, null, "Status changed for {{ticket.id}}" },
                    { new Guid("10000000-0000-0000-0000-000000000006"), "{{status.from}} -> {{status.to}}", NotificationChannelType.Webhook, new DateTimeOffset(new DateTime(2026, 9, 15, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)), NotificationEventType.StatusChanged, null, null }
                });

            migrationBuilder.CreateIndex(
                name: "ix_notification_channels_project_id",
                table: "notification_channels",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_deliveries_channel_id_created_at",
                table: "notification_deliveries",
                columns: new[] { "channel_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_deliveries_project_id",
                table: "notification_deliveries",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_deliveries_status_next_attempt_at",
                table: "notification_deliveries",
                columns: new[] { "status", "next_attempt_at" });

            migrationBuilder.CreateIndex(
                name: "ix_notification_deliveries_ticket_id",
                table: "notification_deliveries",
                column: "ticket_id");

            migrationBuilder.CreateIndex(
                name: "ix_notification_templates_event_type_channel_type",
                table: "notification_templates",
                columns: new[] { "event_type", "channel_type" },
                unique: true,
                filter: "project_id IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_notification_templates_project_id_event_type_channel_type",
                table: "notification_templates",
                columns: new[] { "project_id", "event_type", "channel_type" },
                unique: true,
                filter: "project_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notification_deliveries");

            migrationBuilder.DropTable(
                name: "notification_templates");

            migrationBuilder.DropTable(
                name: "notification_channels");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:attachment_kind", "screenshot,user_upload,console_log")
                .Annotation("Npgsql:Enum:ticket_status", "new,in_progress,resolved,rejected,deleted")
                .OldAnnotation("Npgsql:Enum:attachment_kind", "screenshot,user_upload,console_log")
                .OldAnnotation("Npgsql:Enum:notification_channel_type", "email,webhook")
                .OldAnnotation("Npgsql:Enum:notification_delivery_status", "pending,sending,sent,failed,throttled")
                .OldAnnotation("Npgsql:Enum:notification_event_type", "ticket_created,comment_added,status_changed")
                .OldAnnotation("Npgsql:Enum:ticket_status", "new,in_progress,resolved,rejected,deleted");
        }
    }
}
