// app/routes/app._index.jsx
import { json } from "@remix-run/node";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from "@remix-run/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  InlineStack,
  DataTable,
  Select,
  TextField,
  Button,
  Pagination,
  Badge,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";

import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import { serialize } from "../serialize.server";

const DEFAULT_PAGE_SIZE = 25;

/* ------------------ PERF: only revalidate when it matters ------------------ */
export const shouldRevalidate = ({ currentUrl, nextUrl, formMethod }) => {
  if (formMethod && formMethod !== "GET") return true; // after POST actions
  return currentUrl.search !== nextUrl.search;         // when filters/pagination change
};

/* ------------------ Small private cache to speed back/forward -------------- */
export const headers = () => ({
  "Cache-Control": "private, max-age=5, stale-while-revalidate=30",
});

/* ------------------ SERVER: loader (staff) --------------------------------- */
export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const pageSize = Math.max(
    5,
    Math.min(100, Number(url.searchParams.get("pageSize") || DEFAULT_PAGE_SIZE)),
  );
  const titleFilter = url.searchParams.get("title") || "";

  // total variants for pagination (filtered by product title when provided)
  const totalVariants = await prisma.productVariant.count({
    where: {
      product: titleFilter ? { title: { equals: titleFilter } } : undefined,
    },
  });

  // fetch one page: product + variant + latest physical count
  const variants = await prisma.productVariant.findMany({
    where: {
      product: titleFilter ? { title: { equals: titleFilter } } : undefined,
    },
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      title: true,
      product: { select: { title: true } },
      counts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { counted: true, createdAt: true, userId: true },
      },
    },
  });

  const items = variants.map((v) => ({
    variantId: v.id,
    productTitle: v.product.title,
    variantTitle: v.title ?? "—",
    latestCount: v.counts[0]?.counted ?? null,
  }));

  // Titles for dropdown
  const titles = await prisma.product.findMany({
    select: { title: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return json(
    serialize({
      items,
      totalVariants,
      page,
      pageSize,
      titles: Array.from(new Set(titles.map((t) => t.title))).slice(0, 200),
    }),
  );
};

/* ------------------ CLIENT (staff) ---------------------------------------- */
function toastText(data) {
  if (!data) return "Saved";
  if (typeof data === "string") return data;
  if (typeof data.message === "string") return data.message;
  return "Saved";
}

export default function StaffHome() {
  const {
    items = [],
    totalVariants = 0,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    titles = [],
  } = useLoaderData() ?? {};

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();

  // fetchers
  const countFetcher = useFetcher(); // POST /app/counts/add
  const syncFetcher = useFetcher();  // POST /app/sync/products

  // toast once per completed action
  const didToastRef = useRef(false);
  const anySubmitting =
    (["loading", "submitting"].includes(countFetcher.state) &&
      countFetcher.formMethod === "POST") ||
    (["loading", "submitting"].includes(syncFetcher.state) &&
      syncFetcher.formMethod === "POST");

  useEffect(() => {
    if (anySubmitting) didToastRef.current = false;
  }, [anySubmitting]);

  useEffect(() => {
    const finished =
      (countFetcher.state === "idle" && countFetcher.data?.ok) ||
      (syncFetcher.state === "idle" && syncFetcher.data?.ok);

    if (finished && !didToastRef.current) {
      didToastRef.current = true;
      const msg = toastText(countFetcher.data || syncFetcher.data);
      try {
        shopify.toast.show(msg);
      } catch {}
      revalidator.revalidate();
    }
  }, [countFetcher.state, countFetcher.data, syncFetcher.state, syncFetcher.data, revalidator, shopify]);

  // filter by product title (server-side, keeps pagination correct)
  const urlTitle = searchParams.get("title") || "";
  const [selectedTitle, setSelectedTitle] = useState(urlTitle);

  const applyTitleFilter = (value) => {
    setSelectedTitle(value);
    const params = new URLSearchParams(searchParams);
    if (value) params.set("title", value);
    else params.delete("title");
    params.set("page", "1");
    // preventScrollReset to avoid jump; replace to avoid history spam
    navigate(`?${params.toString()}`, { preventScrollReset: true, replace: true });
  };

  const titleOptions = useMemo(
    () => [{ label: "All products", value: "" }, ...titles.map((t) => ({ label: t, value: t }))],
    [titles],
  );

  // pagination
  const hasPrevious = page > 1;
  const hasNext = totalVariants > page * pageSize;
  const gotoPage = (p) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    navigate(`?${params.toString()}`, { preventScrollReset: true });
  };

  // local input state for counts
  const [countedByVariant, setCountedByVariant] = useState({});
  const setCounted = (variantId, value) =>
    setCountedByVariant((prev) => ({ ...prev, [variantId]: value }));

  const saveCount = (variantId) => {
    const form = new FormData();
    form.set("variantId", variantId);
    form.set("counted", countedByVariant[variantId] ?? "");
    countFetcher.submit(form, { method: "POST", action: "/app/counts/add" });
  };

  // stable columns to avoid hydration/layout issues
  const HEADINGS = ["Title", "Variant", "Last Saved", "Add Count"];
  const columnContentTypes = ["text", "text", "text", "text"];

  const rows = useMemo(
    () =>
      items.map((i) => {
        const countedValue = countedByVariant[i.variantId] ?? "";
        const last = i.latestCount == null ? "—" : String(i.latestCount);

        return [
          i.productTitle,
          i.variantTitle,
          last,
          <InlineStack key={`add-${i.variantId}`} gap="100">
            <TextField
              label="Count"
              labelHidden
              autoComplete="off"
              type="number"
              min={0}
              value={countedValue}
              onChange={(v) => setCounted(i.variantId, v)}
              placeholder="Enter count"
            />
            <Button onClick={() => saveCount(i.variantId)}>Save</Button>
          </InlineStack>,
        ];
      }),
    [items, countedByVariant],
  );

  // summary for this page
  const summary = useMemo(() => {
    let withCount = 0;
    for (const i of items) if (i.latestCount != null) withCount++;
    return { total: items.length, withCount };
  }, [items]);

  const syncing = ["loading", "submitting"].includes(syncFetcher.state);

  return (
    <Page>
      <TitleBar title="Inventory — Staff" />

      <Layout>
        <Layout.Section>
          {/* Header: Summary + Sync */}
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300">
                  <Badge tone="new">Total variants: {summary.total}</Badge>
                  <Badge tone="success">With saved count: {summary.withCount}</Badge>
                </InlineStack>

                {/* Sync products (staff page too) */}
                <syncFetcher.Form method="post" action="/app/sync/products">
                  <Button submit loading={syncing}>
                    {syncing ? "Syncing…" : "Sync products"}
                  </Button>
                </syncFetcher.Form>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Filters */}
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingSm">Filter</Text>
              <InlineStack gap="200" align="start" blockAlign="center">
                <Select
                  label="Product title"
                  labelHidden
                  options={titleOptions}
                  value={selectedTitle}
                  onChange={applyTitleFilter}
                />
                {selectedTitle !== "" && (
                  <Button onClick={() => applyTitleFilter("")} variant="plain">
                    Clear
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Card>

          {/* Table + Pagination */}
          <Card>
            <BlockStack gap="300">
              <DataTable
                columnContentTypes={columnContentTypes}
                headings={HEADINGS}
                rows={rows}
                stickyHeader
              />
              <InlineStack align="center" blockAlign="center" gap="300">
                <Pagination
                  hasPrevious={hasPrevious}
                  onPrevious={() => gotoPage(page - 1)}
                  hasNext={hasNext}
                  onNext={() => gotoPage(page + 1)}
                />
                <Text as="span" variant="bodySm">
                  Page {page} · {Math.min(page * pageSize, totalVariants)} of {totalVariants} variants
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}