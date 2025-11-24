// app/routes/_index.jsx
import { redirect } from "@remix-run/node";

/**
 * Root route:
 * - For any request (GET/HEAD), just redirect to /auth/login.
 * - We do NOT call `login()` here, so no FormData parsing on HEAD.
 */
export const loader = async () => {
  return redirect("/auth/login");
};

export const action = loader; // just in case something POSTs to "/"

export default function Index() {
  // Never actually rendered because loader always redirects
  return null;
}