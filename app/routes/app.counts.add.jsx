// app/routes/app.counts.add.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

// Save a single physical count for a variant
export const action = async ({ request }) => {
  // Ensure we have a session (optional but consistent with app auth)
  await authenticate.admin(request);

  const form = await request.formData();
  const variantId = String(form.get("variantId") || "");
  const raw = String(form.get("counted") || "");
  const note = form.get("note") ? String(form.get("note")) : null;

  if (!variantId) {
    return json({ ok: false, error: "Missing variantId" }, { status: 400 });
  }

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return json({ ok: false, error: "Invalid count" }, { status: 400 });
  }

  // verify variant exists
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true },
  });
  if (!variant) {
    return json({ ok: false, error: "Variant not found" }, { status: 404 });
  }

  await prisma.physicalCount.create({
    data: {
      variantId,
      counted: Math.floor(n),
      note,
      // userId: you can add this later when you wire real roles
    },
  });

  return json({ ok: true, message: "Count saved" });
};

export default function AddCount() {
  return null; // action-only route
}