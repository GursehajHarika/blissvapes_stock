// app/routes/_index.jsx
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * Root of the app (`/`).
 * Shopify will hit this with ?embedded=1&shop=... etc.
 * We never render here – we just authenticate and send them to /app.
 */
export const loader = async ({ request }) => {
  // Let the Shopify Remix helper handle all the heavy auth work
  const { session, redirect: authRedirect } = await authenticate.admin(request);

  // If Shopify needs us to install/reauth, it gives us a redirect:
  if (authRedirect) {
    return authRedirect;
  }

  // If we have a valid session, go straight to the main app route
  return redirect("/app");
};

// If Remix ever posts here, treat it the same as a GET
export const action = loader;

export default function Index() {
  // This never actually renders because we always redirect in loader/action
  return null;
}