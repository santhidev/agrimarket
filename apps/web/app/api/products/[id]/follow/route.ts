import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/app/lib/insforge-server";
import { getCurrentUser } from "@/app/lib/get-profile";

// POST /api/products/:id/follow — follow a product (Issue 16).
//
// Any authenticated user can follow — NO KYC required (the KYC gate is only on
// offer submission, not follow — CONTEXT.md "Follow ได้ทันทีหลังสมัคร — ไม่ต้อง
// รอ KYC"). Following is the go-to-market lever for sellers: register → follow
// → wait for the #17 push → open the app and submit an offer.
//
// Idempotent: a duplicate follow returns 200 with the existing follow, not an
// error. The unique index follows_user_product_uniq is the DB backstop for a
// concurrent-race insert (two follows at once): if the INSERT fails because a
// racing writer inserted first, the route re-reads and returns that row — so
// the endpoint is idempotent even under concurrency, not just on a clean
// second request. (The InsForge SDK has no upsert/onConflict method, so this
// select → insert → retry-select loop is the race-safe shape that stays inside
// the SDK's typed surface.)
//
// Gate: 401 (anon) → 404 (product missing — products are public-read, so any
// authenticated user sees any product) → 200/201. No buyer/seller role:
// "follow" is just "authenticated user subscribes."
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  // Verify the product exists (public read — products are visible to all).
  const { data: product, error: productErr } = await client.database
    .from("products")
    .select("id")
    .eq("id", id)
    .limit(1);

  if (productErr || !product || product.length === 0) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Idempotent fast path: if already following, return the existing follow.
  const existing = await readFollow(client, current.id, id);
  if (existing) {
    return NextResponse.json({ follow: existing });
  }

  // Insert the follow. user_id pinned to the session user — the INSERT RLS
  // policy (follows_insert_own) rejects any mismatch. A racing writer can
  // land this insert first and trip the unique index for us; in that case the
  // retry-select below recovers their row instead of 500-ing.
  const { data, error } = await client.database
    .from("follows")
    .insert([{ user_id: current.id, product_id: id }])
    .select("id, user_id, product_id, created_at")
    .limit(1);

  if (error) {
    // Most likely cause of an insert error here is a unique-index violation
    // (a concurrent follow won the race). Re-read: if a row now exists, the
    // race is resolved idempotently; otherwise it's a genuine failure.
    const retried = await readFollow(client, current.id, id);
    if (retried) {
      return NextResponse.json({ follow: retried });
    }
    return NextResponse.json(
      { error: "Failed to follow product" },
      { status: 500 }
    );
  }

  const row =
    (data?.[0] as
      | {
          id: string;
          user_id: string;
          product_id: string;
          created_at: string;
        }
      | undefined) ?? null;

  if (!row) {
    // Insert reported success but no row returned (e.g. SELECT policy race).
    // Re-read so the caller still gets the row.
    const retried = await readFollow(client, current.id, id);
    if (retried) {
      return NextResponse.json(
        { follow: retried },
        { status: 201 }
      );
    }
    return NextResponse.json(
      { error: "Failed to follow product" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { follow: mapFollow(row) },
    { status: 201 }
  );
}

// DELETE /api/products/:id/follow — unfollow a product (Issue 16).
//
// Idempotent: unfollowing a product the user doesn't follow is a no-op (200,
// not 404) — the end state (not following) is what matters, whether or not a
// row was deleted.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const client = await createInsForgeServerClient();

  const { error } = await client.database
    .from("follows")
    .delete()
    .eq("user_id", current.id)
    .eq("product_id", id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to unfollow product" },
      { status: 500 }
    );
  }

  // Always 200 — whether a row was deleted or not, the user is now not
  // following this product. The end state is the same.
  return NextResponse.json({ ok: true });
}

// --- helpers ---------------------------------------------------------------

type FollowRow = {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
};

function mapFollow(row: FollowRow) {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    createdAt: row.created_at,
  };
}

// Read the current user's follow of a single product, or null if none. RLS
// (follows_select_own_or_admin) scopes this to the caller's own follows.
async function readFollow(
  client: Awaited<ReturnType<typeof createInsForgeServerClient>>,
  userId: string,
  productId: string
): Promise<ReturnType<typeof mapFollow> | null> {
  const { data } = await client.database
    .from("follows")
    .select("id, user_id, product_id, created_at")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .limit(1);
  const row = (data?.[0] as FollowRow | undefined) ?? null;
  return row ? mapFollow(row) : null;
}
