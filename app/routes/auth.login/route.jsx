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

// ❗ Loader must NOT call `login(request)` or touch FormData.
export const loader = async ({ request }) => {
  // Handle HEAD checks gracefully (Shopify or uptime checks).
  if (request.method === "HEAD") {
    return new Response(null, { status: 200 });
  }

  // Initial page load: just render empty form, no errors.
  return {
    errors: {},
    polarisTranslations,
  };
};

// ❗ Action is the only place we call `login(request)`
export const action = async ({ request }) => {
  const result = await login(request);
  const errors = loginErrorMessage(result);

  return {
    errors,
    polarisTranslations,
  };
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