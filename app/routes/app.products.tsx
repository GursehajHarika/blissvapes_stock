import { useLoaderData, Link } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Gatekeep with admin auth so only installed merchants can load this page
  await authenticate.admin(request);
  return json({ ok: true });
}

export default function ProductsPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Products</h1>
      <p>Click to sync all products from your store into the app database.</p>
      <Link to="/app/products/sync">Run sync now</Link>
    </div>
  );
}