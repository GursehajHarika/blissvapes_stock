// app/routes/_index.jsx
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  console.log("[INDEX] loader start:", request.method, request.url);

  const auth = await authenticate.admin(request);

  // If Shopify auth layer wants a redirect (install / re-auth)
  if (auth.redirect) {
    const loc = auth.redirect.headers?.get?.("Location");
    console.log("[INDEX] authenticate.admin → redirecting to:", loc);
    return auth.redirect;
  }

  console.log("[INDEX] authenticate.admin → OK for shop:", auth.admin.session.shop);

  return json({ shop: auth.admin.session.shop });
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