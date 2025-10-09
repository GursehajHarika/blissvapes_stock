// app/role.server.ts
import prisma from "./db.server";
import { authenticate } from "./shopify.server";

/**
 * We identify the Shopify staff via the embedded auth headers:
 * - X-Shopify-Authenticated-User-Id (staff id)
 * We also capture the shop from the session via authenticate.admin(request).
 *
 * Anyone not in DB becomes "staff" by default. You can flip their role to "admin"
 * by updating the User row (or add a tiny promote route later).
 */
export async function getCurrentUserWithRole(request: Request) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const staffId = request.headers.get("X-Shopify-Authenticated-User-Id");

  // In rare cases (older flows / test environments) the header may be missing.
  // Treat it as anonymous staff for safety.
  const fallbackStaffId = `anon-${shop}`;

  const idToUse = staffId || fallbackStaffId;

  // Upsert user; default role = "staff"
  const user = await prisma.user.upsert({
    where: { staffId: idToUse },
    create: {
      shop,
      staffId: idToUse,
      role: "staff",
    },
    update: {
      shop, // keep latest shop string if domain changed
    },
  });

  return { user, shop };
}