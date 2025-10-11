// app/routes/app.admin.jsx
import { json } from "@remix-run/node";
import React from "react";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  DataTable,
  Badge,
  Button,
  InlineStack,
  Select,
  Pagination,
  Modal,
} from "@shopify/polaris";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

const PAGE_SIZE_DEFAULT = 25;

/* --------------------- Loader (server) --------------------- */
export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const pageSize = Math.max(
    5,
    Math.min(100, Number(url.searchParams.get("pageSize") || PAGE_SIZE_DEFAULT)),
  );

  const title = url.searchParams.get("title") || ""; // exact match for simplicity
  const productType = url.searchParams.get("productType") || "";
  const status = url.searchParams.get("status") || ""; // "", "match", "mismatch", "no-count"
  const locationId = url.searchParams.get("locationId") || ""; // Shopify GID string

  // Build where filter for Prisma for product + optional location slice later
  const where = {
    product: title ? { title: { equals: title } } : undefined,
    ...(productType
      ? {
          product: {
            ...(title ? { title: { equals: title } } : {}),
            productType: { equals: productType },
          },
        }
      : {}),
  };

  // Get total variants (before status filter, which we apply after we compute inventory/counts)
  const totalCandidates = await prisma.productVariant.count({ where });

  // Fetch this page of variants
  const variants = await prisma.productVariant.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      title: true,
      product: { select: { title: true, productType: true } },
      inventoryLevels: {
        select: { available: true, locationGid: true, locationName: true },
      },
      counts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { counted: true },
      },
    },
  });

  // Reduce inventory (optionally by chosen location)
  const items = variants.map((v) => {
    const levels = locationId
      ? v.inventoryLevels.filter((lvl) => lvl.locationGid === locationId)
      : v.inventoryLevels;

    const totalInv = levels.reduce((sum, lvl) => sum + (lvl.available || 0), 0);
    const latestCount = v.counts[0]?.counted ?? null;

    // Compute status
    let st = "no-count";
    if (latestCount == null) st = "no-count";
    else if (latestCount === totalInv) st = "match";
    else st = "mismatch";

    return {
      variantId: v.id,
      productTitle: v.product.title,
      productType: v.product.productType || "",
      variantTitle: v.title || "—",
      inventory: totalInv,
      latestCount,
      status: st,
    };
  });

  // Apply status filter AFTER page fetch (keeps query cheap)
  const filteredItems = status ? items.filter((i) => i.status === status) : items;

  // Compute summary for current page (post-filter)
  const summary = filteredItems.reduce(
    (acc, i) => {
      if (i.status === "match") acc.match += 1;
      else if (i.status === "mismatch") acc.mismatch += 1;
      else acc.noCount += 1;
      return acc;
    },
    { match: 0, mismatch: 0, noCount: 0 },
  );

  // Dropdown data: titles, product types, locations
  const titleOptionsRaw = await prisma.product.findMany({
    select: { title: true },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
  const productTypesRaw = await prisma.product.findMany({
    select: { productType: true },
    where: { productType: { not: null } },
    distinct: ["productType"],
    take: 300,
  });
  // Derive locations from any inventoryLevels row (light)
  const locationsRaw = await prisma.variantInventoryLevel.findMany({
    select: { locationGid: true, locationName: true },
    distinct: ["locationGid"],
    take: 200,
  });

  // Note: total pages reflect only the server-side filtered set (title/productType/location not status)
  // Status is applied after data build, so Pagination remains consistent with server slice.
  return json({
    page,
    pageSize,
    totalCandidates, // server-slice count (not status filtered)
    items: filteredItems,
    summary,
    titles: Array.from(new Set(titleOptionsRaw.map((t) => t.title))).slice(0, 300),
    productTypes: productTypesRaw
      .map((p) => p.productType)
      .filter(Boolean)
      .slice(0, 300),
    locations: locationsRaw.map((l) => ({
      id: l.locationGid,
      name: l.locationName || "Unknown location",
    })),
  });
};

/* --------------------- Component (client) --------------------- */
export default function AdminPage() {
  const {
    items = [],
    page = 1,
    pageSize = PAGE_SIZE_DEFAULT,
    totalCandidates = 0,
    summary = { match: 0, mismatch: 0, noCount: 0 },
    titles = [],
    productTypes = [],
    locations = [],
  } = useLoaderData() ?? {};

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const revalidator = useRevalidator();

  // --- Sync products ---
  const syncFetcher = useFetcher();
  const syncing =
    ["loading", "submitting"].includes(syncFetcher.state) &&
    syncFetcher.formMethod === "POST";

  if (syncFetcher.state === "idle" && syncFetcher.data?.ok) {
    revalidator.revalidate();
  }

  // --- Clear All Counts (optional route /app/counts/clear) ---
  const clearFetcher = useFetcher();
  const clearing =
    ["loading", "submitting"].includes(clearFetcher.state) &&
    clearFetcher.formMethod === "POST";

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const confirmClear = () => {
    setConfirmOpen(false);
    clearFetcher.submit(null, { method: "POST", action: "/app/counts/clear" });
  };

  if (clearFetcher.state === "idle" && clearFetcher.data?.ok) {
    revalidator.revalidate();
  }

  // --- Filters state from URL ---
  const urlTitle = searchParams.get("title") || "";
  const urlType = searchParams.get("productType") || "";
  const urlStatus = searchParams.get("status") || "";
  const urlLocationId = searchParams.get("locationId") || "";
  const urlPage = Number(searchParams.get("page") || page);

  const setParam = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    // Reset to first page on filter change
    if (["title", "productType", "status", "locationId"].includes(key)) {
      params.set("page", "1");
    }
    navigate(`?${params.toString()}`, { replace: true, preventScrollReset: true });
  };

  // Pagination
  const hasPrev = urlPage > 1;
  const hasNext = totalCandidates > urlPage * pageSize;
  const gotoPage = (p) => setParam("page", String(p));

  // Table
  const rows = items.map((i) => [
    i.productTitle,
    i.productType || "—",
    i.variantTitle,
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

  // CSV export of current view
  const exportCSV = () => {
    const header = [
      "Product",
      "Product Type",
      "Variant",
      "Inventory",
      "Latest Count",
      "Status",
    ];
    const lines = items.map((i) =>
      [
        i.productTitle,
        i.productType || "",
        i.variantTitle,
        i.inventory,
        i.latestCount ?? "",
        i.status,
      ]
        .map((v) => {
          const s = String(v ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-admin-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const titleOptions = [
    { label: "All titles", value: "" },
    ...titles.map((t) => ({ label: t, value: t })),
  ];
  const typeOptions = [
    { label: "All product types", value: "" },
    ...productTypes.map((t) => ({ label: t, value: t })),
  ];
  const statusOptions = [
    { label: "All statuses", value: "" },
    { label: "Match", value: "match" },
    { label: "Mismatch", value: "mismatch" },
    { label: "No count", value: "no-count" },
  ];
  const locationOptions = [
    { label: "All locations", value: "" },
    ...locations.map((l) => ({ label: l.name, value: l.id })),
  ];

  return (
    <Page
      title="Admin Inventory"
      primaryAction={{
        content: syncing ? "Syncing…" : "Sync products",
        onAction: () =>
          syncFetcher.submit(null, { method: "POST", action: "/app/sync/products" }),
        loading: syncing,
      }}
      secondaryActions={[
        {
          content: "Export CSV",
          onAction: exportCSV,
        },
        {
          content: "Clear All Counts",
          destructive: true,
          onAction: () => setConfirmOpen(true),
          disabled: clearing,
        },
      ]}
    >
      <BlockStack gap="400">
        {/* Summary */}
        <Card>
          <InlineStack gap="400">
            <Badge tone="success">Match: {summary.match}</Badge>
            <Badge tone="attention">Mismatch: {summary.mismatch}</Badge>
            <Badge>No count: {summary.noCount}</Badge>
          </InlineStack>
        </Card>

        {/* Filters */}
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="300" wrap={false}>
              <Select
                label="Title"
                labelHidden
                options={titleOptions}
                value={urlTitle}
                onChange={(v) => setParam("title", v)}
              />
              <Select
                label="Product Type"
                labelHidden
                options={typeOptions}
                value={urlType}
                onChange={(v) => setParam("productType", v)}
              />
              <Select
                label="Status"
                labelHidden
                options={statusOptions}
                value={urlStatus}
                onChange={(v) => setParam("status", v)}
              />
              <Select
                label="Location"
                labelHidden
                options={locationOptions}
                value={urlLocationId}
                onChange={(v) => setParam("locationId", v)}
              />
              <Button
                onClick={() => {
                  setParam("title", "");
                  setParam("productType", "");
                  setParam("status", "");
                  setParam("locationId", "");
                }}
                variant="plain"
              >
                Clear filters
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {/* Table */}
        <Card>
          <BlockStack gap="300">
            <DataTable
              columnContentTypes={[
                "text",
                "text",
                "text",
                "numeric",
                "numeric",
                "text",
              ]}
              headings={[
                "Product",
                "Product Type",
                "Variant",
                "Inventory",
                "Latest Count",
                "Match?",
              ]}
              rows={rows}
              stickyHeader
            />
            <InlineStack align="center" blockAlign="center">
              <Pagination
                hasPrevious={hasPrev}
                onPrevious={() => gotoPage(urlPage - 1)}
                hasNext={hasNext}
                onNext={() => gotoPage(urlPage + 1)}
              />
              <Text as="span" variant="bodySm">
                Page {urlPage} · Showing {items.length} of {totalCandidates} variants
              </Text>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>

      {/* Confirm modal for Clear All Counts */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Clear all counts?"
        primaryAction={{
          destructive: true,
          content: clearing ? "Clearing…" : "Yes, clear",
          onAction: confirmClear,
          loading: clearing,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setConfirmOpen(false) },
        ]}
      >
        <Modal.Section>
          <Text as="p" variant="bodyMd">
            This will remove all physical counts. Inventory levels from Shopify are
            untouched. You can re-count after clearing.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}