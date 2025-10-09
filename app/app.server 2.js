// app/role.server.js
import prisma from "./db.server";
import { authenticate } from "./shopify.server";
import { redirect } from "@remix-run/node";

/**
 * Ensure we have a local User row for this staffer with a role.
 * - Default "staff"
 * - If the Shopify session says accountOwner, or email is in ADMIN_EMAILS, set "admin"
 */
export async function getCurrentUserWithRole(request) {
  const { session, admin } = await authenticate.admin(request);

  // session props depend on your setup; these are provided by the Remix SDK Session model
  const shop = session.shop;
  const staffId = String(session.userId ?? "unknown");
  const email = session.email ?? null;
  const accountOwner = !!session.accountOwner;

  // decide role
  const adminAllowlist =
    (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);

  const computedRole =
    accountOwner || (email && adminAllowlist.includes(email.toLowerCase()))
      ? "admin"
      : "staff";

  // upsert user
  const user = await prisma.user.upsert({
    where: { staffId },
    update: { shop, role: computedRole, email: email ?? undefined, updatedAt: new Date() },
    create: {
      shop,
      staffId,
      role: computedRole,
      email: email ?? null,
    },
  });

  return { user, shop, admin, session };
}

export function isAdmin(user) {
  return user?.role === "admin";
}

export async function requireAdmin(user) {
  if (!isAdmin(user)) {
    throw redirect("/app"); // kick back to staff home
  }
}