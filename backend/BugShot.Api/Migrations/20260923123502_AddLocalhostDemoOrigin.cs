using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BugShot.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLocalhostDemoOrigin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // projekt demo mogl zostac usuniety albo dostac ten origin recznie w panelu
            migrationBuilder.Sql("""
                insert into project_origins (id, origin, project_id)
                select '22222222-2222-2222-2222-222222222223', 'http://localhost:5500', p.id
                from projects p
                where p.id = '11111111-1111-1111-1111-111111111111'
                on conflict do nothing;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "project_origins",
                keyColumn: "id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222223"));
        }
    }
}
