// app/routes/auth.login/route.jsx
import { json } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";

export const loader = async ({ request }) => {
  // Shopify/Admin + Render health checks can hit HEAD
  if (request.method === "HEAD") {
    return new Response(null, { status: 200 });
  }

  const url = new URL(request.url);

  // If someone hits /auth/login?shop=... via GET,
  // we just show the form with the shop prefilled.
  const shop = url.searchParams.get("shop") || "";

  return json({ shop });
};

export const action = async ({ request }) => {
  // Only POST should hit this, but keep it safe.
  if (request.method === "HEAD") {
    return new Response(null, { status: 200 });
  }

  // IMPORTANT: login() reads FormData, so it must be in action (POST)
  return login(request);
};

export default function AuthLogin() {
  const { shop } = useLoaderData();
  const actionData = useActionData();

  // actionData shape depends on your login() + error handler;
  // keep it simple so build/runtime doesn’t break.
  const errors = actionData?.errors || {};

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, -apple-system, Inter, sans-serif" }}>
      <h1>Log in</h1>

      <Form method="post">
        <label style={{ display: "block", marginBottom: 8 }}>
          Shop domain
        </label>

        <input
          name="shop"
          defaultValue={shop}
          placeholder="example.myshopify.com"
          style={{ padding: 8, width: 320, maxWidth: "100%" }}
        />

        {errors.shop ? (
          <div style={{ marginTop: 8 }}>
            <small style={{ color: "crimson" }}>{errors.shop}</small>
          </div>
        ) : null}

        <div style={{ marginTop: 12 }}>
          <button type="submit">Log in</button>
        </div>
      </Form>
    </div>
  );
}