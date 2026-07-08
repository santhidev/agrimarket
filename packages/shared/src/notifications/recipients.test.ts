import { describe, it, expect } from "vitest";
import { demandCreatedRecipients } from "./recipients";

const follows = [
  { userId: "u-seller-a", productId: "p-mango" },
  { userId: "u-seller-b", productId: "p-mango" },
  { userId: "u-seller-c", productId: "p-durian" },
];

describe("demandCreatedRecipients", () => {
  it("returns userIds of followers of the demand's product", () => {
    expect(
      demandCreatedRecipients(
        { productId: "p-mango", buyerId: "u-buyer" },
        follows
      )
    ).toEqual(["u-seller-a", "u-seller-b"]);
  });

  it("excludes other products' followers", () => {
    expect(
      demandCreatedRecipients(
        { productId: "p-durian", buyerId: "u-buyer" },
        follows
      )
    ).toEqual(["u-seller-c"]);
  });

  it("excludes the demand's own buyer if they happen to follow the product", () => {
    const withBuyerFollow = [
      ...follows,
      { userId: "u-buyer", productId: "p-mango" },
    ];
    expect(
      demandCreatedRecipients(
        { productId: "p-mango", buyerId: "u-buyer" },
        withBuyerFollow
      )
    ).toEqual(["u-seller-a", "u-seller-b"]);
  });

  it("returns [] when there are no followers", () => {
    expect(
      demandCreatedRecipients(
        { productId: "p-mango", buyerId: "u-buyer" },
        []
      )
    ).toEqual([]);
  });

  it("dedupes duplicate follows", () => {
    const dup = [
      { userId: "u-seller-a", productId: "p-mango" },
      { userId: "u-seller-a", productId: "p-mango" },
    ];
    expect(
      demandCreatedRecipients(
        { productId: "p-mango", buyerId: "u-buyer" },
        dup
      )
    ).toEqual(["u-seller-a"]);
  });
});
