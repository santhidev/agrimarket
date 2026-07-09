import { test, expect, request as playwrightRequest } from "@playwright/test";
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

  // --- Step 4: create a seller API context (seller's session) ---
  // The test's `request` fixture is the buyer's session; create a separate
  // APIRequestContext for the seller via the standalone request factory (the
  // APIRequestContext fixture has no newContext method).
  const sellerRequest = await playwrightRequest.newContext({
    storageState: TEST.seller.storageState,
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
  });

  // --- Step 5: seller submits an offer (API fallback — no UI button) ---
  const gradeId = process.env.E2E_PRODUCT_GRADE_ID!;
  await test.step("seller submits offer", async () => {
    const readyDate = new Date(Date.now() + 3 * 86400000).toISOString();
    const res = await sellerRequest.post(`/api/offers`, {
      data: {
        demandId,
        productGradeId: gradeId,
        pricePerUnit: 80,
        quantity: 100,
        photos: [],
        pickupLat: 13.7563,
        pickupLng: 100.5018,
        readyDate,
      },
    });
    expect(res.status()).toBe(201);
    const json = await res.json();
    offerId = json.offer.id;
    expect(json.offer.status).toBe("ACTIVE");
  });

  // --- Step 6: buyer sees the offer + best-offer ---
  await test.step("buyer sees offer + best-offer", async () => {
    const res = await request.get(`/api/demands/${demandId}/offers`);
    const json = await res.json();
    expect(json.offers.length).toBeGreaterThanOrEqual(1);
    const best = await request.post(`/api/demands/${demandId}/best-offer`, {
      data: {},
    });
    expect(best.ok()).toBe(true);
  });

  // --- Step 7: buyer selects the offer (API fallback) ---
  await test.step("buyer selects offer", async () => {
    const res = await request.post(`/api/demands/${demandId}/select`, {
      data: {
        offers: [{ offerId, acceptedQuantity: 100 }],
      },
    });
    expect(res.ok()).toBe(true);
    // Verify the offer moved to PENDING_SELLER_CONFIRMATION. The buyer-facing
    // GET /api/demands/:id/offers returns every offer on the buyer's demand with
    // full status; GET /api/offers is seller-scoped (seller_id = auth.uid()) and
    // would return nothing for the buyer.
    const offerRes = await request.get(`/api/demands/${demandId}/offers`);
    const offerJson = await offerRes.json();
    const sel = offerJson.offers.find((o: { id: string }) => o.id === offerId);
    expect(sel.status).toBe("PENDING_SELLER_CONFIRMATION");
  });

  // --- Step 8: seller confirms the sale (API fallback, seller session) ---
  await test.step("seller confirms sale", async () => {
    const res = await sellerRequest.post(`/api/offers/${offerId}/confirm-sale`);
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.offer.status).toBe("CONFIRMED");
  });

  // --- Step 9: buyer matches (API fallback) ---
  await test.step("buyer matches", async () => {
    const res = await request.post(`/api/demands/${demandId}/match`);
    expect(res.ok()).toBe(true);
    // Verify demand status → MATCHED.
    const detail = await request.get(`/api/demands/${demandId}`);
    const json = await detail.json();
    expect(json.demand.status).toBe("MATCHED");
  });

  // --- Step 10: buyer sees the seller's phone (the key happy-path assertion) ---
  await test.step("buyer sees seller contacts", async () => {
    const res = await request.get(`/api/demands/${demandId}/contacts`);
    expect(res.ok()).toBe(true);
    const json = await res.json();
    // The contacts endpoint returns the matched sellers' phone numbers. Each
    // entry is { offerId, sellerId, sellerPhone, acceptedQuantity }.
    const contacts = json.contacts ?? json.sellers ?? [];
    expect(contacts.length).toBeGreaterThanOrEqual(1);
    expect(
      contacts.some((c: { sellerPhone?: string }) => c.sellerPhone)
    ).toBe(true);
  });

  // --- Step 11 (bonus): notifications arrived ---
  await test.step("buyer sees notifications", async () => {
    const res = await request.get(`/api/notifications?limit=5`);
    const json = await res.json();
    // At least the offer.created + seller_confirmed notifications.
    expect(json.unreadCount).toBeGreaterThanOrEqual(1);
  });

  // Cleanup the seller request context.
  await sellerRequest.dispose();
});
