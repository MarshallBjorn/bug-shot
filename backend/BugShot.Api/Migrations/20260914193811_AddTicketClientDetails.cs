using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BugShot.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTicketClientDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "browser_name",
                table: "tickets",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<double>(
                name: "device_pixel_ratio",
                table: "tickets",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "device_type",
                table: "tickets",
                type: "character varying(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "language",
                table: "tickets",
                type: "character varying(35)",
                maxLength: 35,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "os_name",
                table: "tickets",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "page",
                table: "tickets",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "time_zone",
                table: "tickets",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "viewport_height",
                table: "tickets",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "viewport_width",
                table: "tickets",
                type: "integer",
                nullable: true);

            // jednorazowe uzupelnienie istniejacych zgloszen tymi samymi regulami co PageAddress i UserAgentParser
            // viewport jezyk i strefa zostaja puste bo starsze zgloszenia ich nie niosly
            migrationBuilder.Sql("""
                update tickets set
                    page = lower(rtrim(regexp_replace(split_part(split_part(btrim(page_url), '#', 1), '?', 1), '^.*?://', ''), '/')),
                    browser_name = case
                        when btrim(user_agent) = '' then ''
                        when user_agent ilike '%Edg/%' or user_agent ilike '%EdgA/%' or user_agent ilike '%EdgiOS/%' then 'Edge'
                        when user_agent ilike '%OPR/%' or user_agent ilike '%Opera%' then 'Opera'
                        when user_agent ilike '%SamsungBrowser/%' then 'Samsung Internet'
                        when user_agent ilike '%Firefox/%' or user_agent ilike '%FxiOS/%' then 'Firefox'
                        when user_agent ilike '%Chrome/%' or user_agent ilike '%CriOS/%' then 'Chrome'
                        when user_agent ilike '%Safari/%' and user_agent ilike '%Version/%' then 'Safari'
                        else 'Other'
                    end,
                    os_name = case
                        when btrim(user_agent) = '' then ''
                        when user_agent ilike '%iPhone%' or user_agent ilike '%iPad%' or user_agent ilike '%iPod%' then 'iOS'
                        when user_agent ilike '%Android%' then 'Android'
                        when user_agent ilike '%Windows%' then 'Windows'
                        when user_agent ilike '%CrOS%' then 'ChromeOS'
                        when user_agent ilike '%Macintosh%' or user_agent ilike '%Mac OS X%' then 'macOS'
                        when user_agent ilike '%Linux%' then 'Linux'
                        else 'Other'
                    end,
                    device_type = case
                        when btrim(user_agent) = '' then ''
                        when user_agent ilike '%iPad%' or user_agent ilike '%Tablet%'
                            or (user_agent ilike '%Android%' and user_agent not ilike '%Mobile%') then 'tablet'
                        when user_agent ilike '%Mobi%' or user_agent ilike '%iPhone%' or user_agent ilike '%iPod%' then 'mobile'
                        else 'desktop'
                    end
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "browser_name",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "device_pixel_ratio",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "device_type",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "language",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "os_name",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "page",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "time_zone",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "viewport_height",
                table: "tickets");

            migrationBuilder.DropColumn(
                name: "viewport_width",
                table: "tickets");
        }
    }
}
