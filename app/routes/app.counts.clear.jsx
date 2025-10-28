// app/routes/app.counts.clear.jsx
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  await authenticate.admin(request);

  // Danger operation: wipe all PhysicalCount rows
  await prisma.physicalCount.deleteMany({});

  return json({ ok: true, message: "All counts cleared" });
};

export const loader = () => json({ ok: true });