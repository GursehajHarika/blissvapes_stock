// app/routes/app.jsx
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/shopify-app-remix/react"; // IMPORTANT: use this one
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  console.log("[APP] loader:", request.method, request.url);
  const { admin } = await authenticate.admin(request);
  console.log("[APP] authed shop:", admin.session.shop);

  return { apiKey: process.env.SHOPIFY_API_KEY || "", shop: admin.session.shop };
};

export default function AppLayout() {
  const { apiKey, shop } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/admin">Admin</Link>
        <Link to="/app/additional">Logs</Link>
      </NavMenu>

      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Shop: {shop}</div>
      </div>

      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  console.error("[APP] ErrorBoundary:", useRouteError());
  return boundary.error(useRouteError());
}
export const headers = (headersArgs) => boundary.headers(headersArgs);