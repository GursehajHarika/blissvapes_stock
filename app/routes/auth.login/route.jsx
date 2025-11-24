// app/routes/auth.login/route.jsx
import { useState } from "react";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

/**
 * LOADER:
 * - For HEAD: just say "OK" (no body parsing).
 * - For GET: render the login form, *without* calling `login()`.
 *   (login() is only used in the action on POST.)
 */
export const loader = async ({ request }) => {
  if (request.method === "HEAD") {
    // Shopify sometimes probes routes with HEAD; don't try to parse FormData
    return new Response(null, { status: 200 });
  }

  // Initial page load: just show empty form, no error
  const errors = {};
  return { errors, polarisTranslations };
};

/**
 * ACTION:
 * - Handles the login form POST.
 * - Here we call `login(request)`, which:
 *   - Validates the `shop` param
 *   - Redirects to Shopify OAuth/install flow when valid
 *   - Returns an object with errors when invalid (handled by loginErrorMessage)
 */
export const action = async ({ request }) => {
  const result = await login(request);
  const errors = loginErrorMessage(result);
  return { errors };
};

export default function AuthLogin() {
  const loaderData = useLoaderData();
  const actionData = useActionData();

  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;

  return (
    <PolarisAppProvider i18n={loaderData.polarisTranslations}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Log in
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="example.myshopify.com"
                value={shop}
                onChange={setShop}
                autoComplete="on"
                error={errors?.shop}
              />
              <Button submit>Log in</Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </PolarisAppProvider>
  );
}