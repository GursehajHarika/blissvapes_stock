// app/routes/_index.jsx
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  console.log("[INDEX] loader start:", request.method, request.url);

  // This handles Shopify admin auth (sessions, redirects, etc.)
  const { admin, redirect } = await authenticate.admin(request);

  if (redirect) {
    const loc = redirect.headers?.get?.("Location");
    console.log("[INDEX] authenticate.admin → redirecting to:", loc);
    return redirect;
  }

  console.log("[INDEX] authenticate.admin → OK for shop:", admin.session.shop);

  return json({ shop: admin.session.shop });
};

export const action = loader;

export default function Index() {
  const { shop } = useLoaderData();
  console.log("[INDEX] component render for shop:", shop);

  return (
    <div
      style={{
        padding: 16,
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
      }}
    >
      <h1>Bliss Vapes Stock App</h1>
      <p>
        Connected shop: <strong>{shop}</strong>
      </p>
      <p>If you can see this, Shopify auth + UI rendering are working.</p>
    </div>
  );
}