// app/routes/_index.jsx
import { json, redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  console.log("[INDEX] loader:", request.method, request.url);

  // Shopify / platforms may probe with HEAD (don’t auth on HEAD)
  if (request.method === "HEAD") {
    return json({ ok: true });
  }

  const auth = await authenticate.admin(request);

  // If Shopify auth layer wants a redirect (install / re-auth)
  if (auth?.redirect) {
    const loc = auth.redirect.headers?.get("Location");
    console.log("[INDEX] authenticate.admin → redirect:", loc);
    return auth.redirect;
  }

  const shop = auth?.admin?.session?.shop;
  console.log("[INDEX] authenticate.admin → OK shop:", shop);

  // ✅ Send into your embedded app shell route
  return redirect("/app");
};

export const action = loader;

export default function Index() {
  return null;
}