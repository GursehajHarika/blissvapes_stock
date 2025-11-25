// app/routes/_index.jsx
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * Root entry for the app.
 * - Shopify Admin hits `/` with embedded / id_token / shop params.
 *   We pass that to `authenticate.admin`, which will handle install/login.
 * - Direct browser hits go to /auth/login.
 */
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const method = request.method;

  // Shopify (and Render) send a lot of HEAD probes.
  // Just say "ok" and don't try to run auth logic.
  if (method === "HEAD") {
    return new Response(null, { status: 200 });
  }

  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");
  const embedded = url.searchParams.get("embedded");
  const idToken = url.searchParams.get("id_token");

  // Requests coming from Shopify Admin (embedded app)
  if (shop || host || embedded === "1" || idToken) {
    const { redirect: authRedirect } = await authenticate.admin(request);

    // If Shopify wants to redirect (install, re-auth, etc.)
    if (authRedirect) return authRedirect;

    // If we got here, session is valid; send to the main app UI
    return redirect("/app");
  }

  // Non-Shopify traffic: show manual login screen
  return redirect("/auth/login");
};

// Treat POST the same as GET for this route
export const action = loader;

export default function Index() {
  // Never actually rendered; we always redirect in loader/action.
  return null;
}