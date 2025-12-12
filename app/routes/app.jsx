// app/routes/app.jsx
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },

  // optional prefetch:
  { rel: "prefetch", as: "document", href: "/app/admin" },
  { rel: "prefetch", as: "document", href: "/app/additional" },
];

export const loader = async ({ request }) => {
  // This will redirect to install/auth if needed
  await authenticate.admin(request);

  console.log("[APP] loader OK:", request.method, request.url);

  return { apiKey: process.env.SHOPIFY_API_KEY ?? "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">Home</Link>
        <Link to="/app/additional">Logs</Link>
        <Link to="/app/admin">Admin</Link>
      </NavMenu>

      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}
export const headers = (args) => boundary.headers(args);