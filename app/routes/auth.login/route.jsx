import { useState } from "react";
import {
  Form,
  useActionData,
  useLoaderData,
} from "@remix-run/react";
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

import { json } from "@remix-run/node";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

/* ----------------------------- LOADER ----------------------------- */

export const loader = async ({ request }) => {
  // Shopify pings via HEAD before rendering inside iframe
  if (request.method === "HEAD") {
    return json({
      errors: null,
      polarisTranslations,
    });
  }

  const errors = loginErrorMessage(await login(request));

  return json({
    errors,
    polarisTranslations,
  });
};

/* ----------------------------- ACTION ----------------------------- */

export const action = async ({ request }) => {
  // HEAD requests cannot contain formData → must skip to avoid FormData crash
  if (request.method === "HEAD") {
    return json({ ok: true });
  }

  const errors = loginErrorMessage(await login(request));

  return json({
    errors,
  });
};

/* ----------------------------- COMPONENT ----------------------------- */

export default function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();

  const [shop, setShop] = useState("");
  const errors = actionData?.errors || loaderData?.errors;

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