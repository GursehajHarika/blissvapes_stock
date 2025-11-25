// app/routes/auth.login/route.jsx
import { json } from "@remix-run/node";
import { login } from "../../shopify.server";

// Handle Shopify & browser preflight HEAD requests safely
export const loader = async ({ request }) => {
  if (request.method === "HEAD") {
    // Don’t try to parse FormData or run login — just say “OK”
    return new Response(null, { status: 200 });
  }

  // Delegate everything to Shopify’s login helper
  // This will:
  // - Redirect to Shopify if needed (OAuth)
  // - Redirect back to /app after install/auth
  // - Return JSON errors only in edge cases
  return login(request);
};

export const action = async ({ request }) => {
  if (request.method === "HEAD") {
    return new Response(null, { status: 200 });
  }

  return login(request);
};

// We don’t render a UI here for embedded apps.
// Shopify will redirect into Admin and load /app after auth.
// You *can* render a fallback if you want, but it’s not required.
export default function AuthLogin() {
  return null;
}