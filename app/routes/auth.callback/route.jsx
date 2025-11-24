
import { authenticate } from "../../shopify.server";

export const loader = async ({ request }) => {
  // This completes OAuth and redirects into /app
  return authenticate.admin(request);
};

export const action = loader;