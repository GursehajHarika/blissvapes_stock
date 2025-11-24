import { redirect } from "@remix-run/node";

export const loader = async () => {
  // Send browsers to Shopify login screen
  return redirect("/auth/login");
};

export default function Index() {
  // Never actually rendered because of redirect
  return null;
}