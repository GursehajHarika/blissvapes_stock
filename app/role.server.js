// app/role.server.js
import prisma from "./db.server";
import { authenticate } from "./shopify.server";

/**
 * Returns { user, shop } for the current request.
 * - Ensures a User row exists (default role = "staff").
 * - Uses X-Shopify-Authenticated-User-Id header when present.
 * - Falls back to anon id per shop if header is missing in dev.
 */
export async function getCurrentUserWithRole(request) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Shopify sets this when the embedded user is a staff member
  const staffHeader = request.headers.get("X-Shopify-Authenticated-User-Id");
  const staffId = staffHeader && staffHeader.trim() ? staffHeader.trim() : `anon-${shop}`;

  // Upsert a user; default role = "staff"
  const user = await prisma.user.upsert({
    where: { staffId },
    create: {
      shop,
      staffId,
      role: "staff", // default
    },
    update: {
      shop, // keep shop fresh if it changes
    },
  });

  return { user, shop };
}

/** Convenience boolean */
export function isAdmin(user) {
  return user?.role === "admin";
}

/**
 * Throws 403 if the current user is not admin.
 * Use at the top of admin-only loaders/actions:
 *
 *   const { user } = await getCurrentUserWithRole(request);
 *   await requireAdmin(user);
 */
export async function requireAdmin(user) {
  if (!isAdmin(user)) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}

/** Promote a user (by staffId) to admin. Useful for simple admin setup tools. */
export async function promoteUser(staffId) {
  return prisma.user.update({
    where: { staffId },
    data: { role: "admin" },
  });
}

/** Demote a user back to staff. */
export async function demoteUser(staffId) {
  return prisma.user.update({
    where: { staffId },
    data: { role: "staff" },
  });
}