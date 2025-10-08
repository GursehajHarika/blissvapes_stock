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

/* ------------------ SERVER: loader (staff) ------------------ */
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

/* ------------------ CLIENT (staff) ------------------ */
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

  // fetcher for saving counts
  const countFetcher = useFetcher();

  // toast once per completed action
  const didToastRef = useRef(false);
  const submitting =
    ["loading", "submitting"].includes(countFetcher.state) &&
    countFetcher.formMethod === "POST";

  useEffect(() => {
    if (submitting) didToastRef.current = false;
  }, [submitting]);

  useEffect(() => {
    const finished = countFetcher.state === "idle" && countFetcher.data?.ok;
    if (finished && !didToastRef.current) {
      didToastRef.current = true;
      try {
        shopify.toast.show(toastText(countFetcher.data));
      } catch {}
      revalidator.revalidate();
    }
  }, [countFetcher.state, countFetcher.data, revalidator, shopify]);

  // filter by product title (server-side, keeps pagination correct)
  const urlTitle = searchParams.get("title") || "";
  const [selectedTitle, setSelectedTitle] = useState(urlTitle);

  const applyTitleFilter = (value) => {
    setSelectedTitle(value);
    const params = new URLSearchParams(searchParams);
    if (value) params.set("title", value);
    else params.delete("title");
    params.set("page", "1");
    navigate(`?${params.toString()}`, { preventScrollReset: true, replace: true });
  };

  const titleOptions = [
    { label: "All products", value: "" },
    ...titles.map((t) => ({ label: t, value: t })),
  ];

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

  // simple summary for staff page: how many items have any saved count
  const summary = useMemo(() => {
    let withCount = 0;
    for (const i of items) if (i.latestCount != null) withCount++;
    return { total: items.length, withCount };
  }, [items]);

  return (
    <Page>
      <TitleBar title="Inventory — Staff" />

      <Layout>
        <Layout.Section>
          {/* Summary */}
          <Card>
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">Summary (this page)</Text>
              <InlineStack gap="300">
                <Badge tone="new">Total variants: {summary.total}</Badge>
                <Badge tone="success">With saved count: {summary.withCount}</Badge>
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