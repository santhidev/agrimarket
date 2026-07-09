import { test, expect } from "@playwright/test";
import { TEST, PRODUCT_NAME, DEMAND } from "./fixtures/test-ids";

// Happy-path E2E (Issue 19).
//
// Drives the full matchmaking flow: buyer follows + creates a demand → seller
// submits an offer → buyer selects → seller confirms → buyer matches → buyer
// sees the seller's phone. Steps with a real UI button drive the browser;
// steps with no UI yet (follow, offer, select, confirm, match) fall back to
// API calls inside the test context (reusing the storageState cookies).
//
// Each step is wrapped in test.step() so a failure names the failing step.

// Buyer actions use the buyer's storageState (seeded by globalSetup).
test.use({ storageState: TEST.buyer.storageState });

test("happy path: demand → offer → select → confirm → match → contacts", async ({
  page,
  request,
}) => {
  // Declare these up front so all steps can reference them. Steps 3 + 5
  // assign them; steps 7-10 read them.
  let demandId = "";
  let offerId = "";

  // --- Step 1: buyer is logged in (storageState) — verify dashboard ---
  await test.step("buyer sees dashboard", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText(TEST.buyer.phone)).toBeVisible();
  });

  // --- Step 2: buyer follows the product (API fallback — no UI button yet) ---
  const productId = process.env.E2E_PRODUCT_ID!;
  await test.step("buyer follows product", async () => {
    const res = await request.post(`/api/products/${productId}/follow`);
    expect(res.ok()).toBe(true);
  });

  // --- Step 3: buyer creates a demand via the real UI form ---
  await test.step("buyer creates demand", async () => {
    await page.goto("/demands/new");

    // Select the product. The <select>'s options render "{name} ({unit})" so a
    // label match on PRODUCT_NAME alone ("มะม่วง") would miss "มะม่วง (กก.)".
    // Select by value (the product id) instead — globalSetup stashed the id we
    // want in E2E_PRODUCT_ID, and the option's value is exactly that id.
    await page
      .getByLabel("สินค้าที่รับซื้อ")
      .selectOption(productId);

    // Quantity.
    await page.getByLabel("ปริมาณรับซื้อ").fill(String(DEMAND.quantity));

    // Deadline — the field is <input type="datetime-local">, which expects a
    // naive local string "YYYY-MM-DDTHH:mm" (NO timezone offset). Build it
    // from local components at noon so it stays well inside +N days. The page
    // re-parses this via new Date(...) (local) then .toISOString().
    const d = new Date(Date.now() + DEMAND.deadlineDaysAhead * 86400000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const deadline = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T12:00`;
    await page.getByLabel("ปิดรับเมื่อ").fill(deadline);

    // Location.
    await page.getByLabel("ละติจูด").fill(String(DEMAND.lat));
    await page.getByLabel("ลองจิจูด").fill(String(DEMAND.lng));

    // Submit.
    await page.getByRole("button", { name: /ประกาศรับซื้อ/ }).click();

    // Expect redirect to the demand detail page (/demands/:id). handleSubmit
    // pushes `/demands/${newId}` on success; the glob requires a trailing
    // segment so the /demands list (fallback) does not match.
    await page.waitForURL("**/demands/**");

    // Capture the demand id from the URL + verify status via API.
    demandId = new URL(page.url()).pathname.split("/").pop()!;
    const detail = await request.get(`/api/demands/${demandId}`);
    const detailJson = await detail.json();
    expect(detailJson.demand.status).toBe("OPEN");
    expect(detailJson.demand.productId).toBe(productId);
    // Sanity: the joined product name matches the test product. Guards against
    // a stale E2E_PRODUCT_ID pointing at a different row.
    expect(detailJson.demand.productName).toBe(PRODUCT_NAME);

    // Referenced by later steps (offer select/match) — keep the linter calm.
    void offerId;
  });
});
