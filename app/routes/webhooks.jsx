// app/routes/webhooks.jsx
import { authenticate } from "../shopify.server";

// POST /webhooks
export const action = async ({ request }) => {
  try {
    // Validates HMAC + dispatches to the handlers you defined in shopify.server.js
    return authenticate.webhook(request);
  } catch (e) {
    console.error("Webhook error", e);
    return new Response("Webhook error", { status: 500 });
  }
};

// Optional: GET /webhooks for health checks
export const loader = () => new Response("OK");