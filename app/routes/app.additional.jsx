// app/routes/app.additional.jsx
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  DataTable,
} from "@shopify/polaris";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // Fetch recent count logs
  const logs = await prisma.physicalCount.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      counted: true,
      createdAt: true,
      user: { select: { email: true } },
      variant: {
        select: {
          title: true,
          product: { select: { title: true } },
        },
      },
    },
  });

  return json({ logs });
};

export default function LogsPage() {
  const { logs } = useLoaderData();

  const rows = logs.map((log) => [
    log.variant.product.title,
    log.variant.title,
    log.user?.email || "—",
    String(log.counted),
    new Date(log.createdAt).toLocaleString(),
  ]);

  return (
    <Page title="Logs">
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd">
            Recent inventory count activity
          </Text>
          <DataTable
            columnContentTypes={["text", "text", "text", "numeric", "text"]}
            headings={[
              "Product",
              "Variant",
              "User",
              "Counted",
              "Last Edited",
            ]}
            rows={rows}
          />
        </BlockStack>
      </Card>
    </Page>
  );
}