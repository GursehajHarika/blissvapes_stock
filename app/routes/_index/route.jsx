


// app/routes/_index/route.jsx
import { redirect } from "@remix-run/node";
import { authenticate } from "../../shopify.server";

export const loader = async ({ request }) => {
  // Critical: Let Shopify establish or validate the session
  const { session, redirect: authRedirect } = await authenticate.admin(request);

  // Shopify says the session isn't valid → redirect to Shopify OAuth
  if (authRedirect) return authRedirect;

  // If authenticated → go to /app
  return redirect("/app");
};

export const action = loader;

export default function Index() {
  return null;
}