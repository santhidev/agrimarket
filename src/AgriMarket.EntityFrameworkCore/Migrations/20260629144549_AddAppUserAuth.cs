using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AgriMarket.Migrations
{
    /// <inheritdoc />
    public partial class AddAppUserAuth : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BuyerScore",
                table: "AbpUsers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "FcmToken",
                table: "AbpUsers",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "HubId",
                table: "AbpUsers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsAdmin",
                table: "AbpUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsHubStaff",
                table: "AbpUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsRider",
                table: "AbpUsers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "KycStatus",
                table: "AbpUsers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SellerScore",
                table: "AbpUsers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Tier",
                table: "AbpUsers",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BuyerScore",
                table: "AbpUsers");

            migrationBuilder.DropColumn(
                name: "FcmToken",
                table: "AbpUsers");

            migrationBuilder.DropColumn(
                name: "HubId",
                table: "AbpUsers");

            migrationBuilder.DropColumn(
                name: "IsAdmin",
                table: "AbpUsers");

            migrationBuilder.DropColumn(
                name: "IsHubStaff",
                table: "AbpUsers");

            migrationBuilder.DropColumn(
                name: "IsRider",
                table: "AbpUsers");

            migrationBuilder.DropColumn(
                name: "KycStatus",
                table: "AbpUsers");

            migrationBuilder.DropColumn(
                name: "SellerScore",
                table: "AbpUsers");

            migrationBuilder.DropColumn(
                name: "Tier",
                table: "AbpUsers");
        }
    }
}
