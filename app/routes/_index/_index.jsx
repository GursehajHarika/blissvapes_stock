// app/routes/_index.jsx
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const method = request.method;

  console.log("[INDEX] Incoming:", method, url.toString());

  if (method === "HEAD") {
    console.log("[INDEX] HEAD request → 200 OK");
    return new Response(null, { status: 200 });
  }

  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");
  const embedded = url.searchParams.get("embedded");
  const idToken = url.searchParams.get("id_token");

  console.log("[INDEX] Params:", { shop, host, embedded, idToken });

  if (shop || host || embedded === "1" || idToken) {
    console.log("[INDEX] → Authenticate admin()");
    const { redirect: authRedirect } = await authenticate.admin(request);

    if (authRedirect) {
      console.log("[INDEX] authenticate.admin → redirecting user");
      return authRedirect;
    }

    console.log("[INDEX] authenticate.admin → valid session, redirecting to /app");
    return redirect("/app");
  }

  console.log("[INDEX] No Shopify params → redirect /auth/login");
  return redirect("/auth/login");
};

export const action = loader;

export default function Index() {
  return null;
}