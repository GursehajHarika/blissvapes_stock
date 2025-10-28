// app/routes/app.admin.jsx
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  DataTable,
  Badge,
  Button,
} from "@shopify/polaris";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const variants = await prisma.productVariant.findMany({
    take: 200,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      product: { select: { title: true } },
      inventoryLevels: { select: { available: true } },
      counts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { counted: true },
      },
    },
  });

  const items = variants.map((v) => {
    const inv = v.inventoryLevels.reduce((sum, lvl) => sum + lvl.available, 0);
    const latest = v.counts[0]?.counted ?? null;
    return {
      product: v.product.title,
      variant: v.title,
      inventory: inv,
      latestCount: latest,
    };
  });

  return json({ items });
};

export default function AdminPage() {
  const { items } = useLoaderData();

  const rows = items.map((i) => [
    i.product,
    i.variant,
    String(i.inventory),
    i.latestCount == null ? "—" : String(i.latestCount),
    i.latestCount == null ? (
      <Badge>—</Badge>
    ) : i.latestCount === i.inventory ? (
      <Badge tone="success">Match</Badge>
    ) : (
      <Badge tone="attention">Mismatch</Badge>
    ),
  ]);

  return (
    <Page title="Admin Inventory">
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd">
            Admin-only inventory view
          </Text>
          <DataTable
            columnContentTypes={["text", "text", "numeric", "numeric", "text"]}
            headings={[
              "Product",
              "Variant",
              "Inventory",
              "Latest Count",
              "Match?",
            ]}
            rows={rows}
          />
          <Button variant="primary">Clear All Counts</Button>
        </BlockStack>
      </Card>
    </Page>
  );
}