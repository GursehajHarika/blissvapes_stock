// app/routes/app.sync.products.jsx
import { json } from "@remix-run/node";
import { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { VARIANTS_QUERY } from "../graphql/variants";

const dec = (v) => (v == null ? null : new Prisma.Decimal(v));

const qtyByName = (lvl, name) =>
  Array.isArray(lvl?.quantities)
    ? lvl.quantities.find((q) => q?.name === name)?.quantity
    : undefined;

const computeAvailable = (lvl) => {
  const qAvail = qtyByName(lvl, "available");
  if (typeof qAvail === "number") return qAvail;
  const onHand = qtyByName(lvl, "on_hand") ?? 0;
  const committed = qtyByName(lvl, "committed") ?? 0;
  const reserved = qtyByName(lvl, "reserved") ?? 0;
  return Math.max(0, onHand - committed - reserved);
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  let cursor = null;
  let pages = 0;
  let variantUpserts = 0;
  const syncedProducts = new Set();

  while (true) {
    const resp = await admin.graphql(VARIANTS_QUERY, { variables: { cursor } });
    const data = await resp.json();

    const nodes = data?.data?.productVariants?.nodes ?? [];
    const pageInfo = data?.data?.productVariants?.pageInfo ?? { hasNextPage: false };

    for (const v of nodes) {
      const p = v.product;
      syncedProducts.add(p.id);

      // Upsert product (id only needed for FK)
      const product = await prisma.product.upsert({
        where: { shopifyGid: p.id },
        create: {
          shopifyGid: p.id,
          handle: p.handle,
          title: p.title,
          vendor: p.vendor ?? null,
          productType: p.productType ?? null,
          status: p.status ?? null,
          tagsCsv: (p.tags ?? []).join(","),
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
          publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
        },
        update: {
          handle: p.handle,
          title: p.title,
          vendor: p.vendor ?? null,
          productType: p.productType ?? null,
          status: p.status ?? null,
          tagsCsv: (p.tags ?? []).join(","),
          updatedAt: new Date(p.updatedAt),
          publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
        },
        select: { id: true },
      });

      // Upsert this single variant (don’t delete others for the product)
      const variant = await prisma.productVariant.upsert({
        where: { shopifyGid: v.id },
        create: {
          productId: product.id,
          shopifyGid: v.id,
          legacyId: v.legacyResourceId ? BigInt(v.legacyResourceId) : null,
          title: v.title ?? null,
          sku: v.sku ?? null,
          price: dec(v.price) ?? new Prisma.Decimal(0),
          compareAtPrice: dec(v.compareAtPrice),
          position: v.position ?? null,
          availableForSale: v.availableForSale ?? null,
          createdAt: new Date(v.createdAt),
          updatedAt: new Date(v.updatedAt),
        },
        update: {
          productId: product.id,
          title: v.title ?? null,
          sku: v.sku ?? null,
          price: dec(v.price) ?? new Prisma.Decimal(0),
          compareAtPrice: dec(v.compareAtPrice),
          position: v.position ?? null,
          availableForSale: v.availableForSale ?? null,
          updatedAt: new Date(v.updatedAt),
        },
        select: { id: true },
      });
      variantUpserts += 1;

      // Replace inventory levels for this variant
      await prisma.variantInventoryLevel.deleteMany({ where: { variantId: variant.id } });

      const levels = v.inventoryItem?.inventoryLevels?.nodes ?? [];
      if (levels.length) {
        await prisma.variantInventoryLevel.createMany({
          data: levels.map((lvl) => ({
            variantId: variant.id,
            locationGid: lvl.location.id,
            locationName: lvl.location.name,
            available: computeAvailable(lvl),
          })),
        });
      } else {
        // Fallback: variant-level total if present
        const total = typeof v.inventoryQuantity === "number" ? v.inventoryQuantity : 0;
        await prisma.variantInventoryLevel.create({
          data: {
            variantId: variant.id,
            locationGid: "gid://shopify/Location/unknown",
            locationName: "All Locations",
            available: total,
          },
        });
      }
    }

    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor ?? null;
    pages += 1;
    await new Promise((r) => setTimeout(r, 150)); // be gentle with limits
  }

  // Prune products removed from Shopify (variants & levels cascade via FK)
  await prisma.product.deleteMany({
    where: { shopifyGid: { notIn: Array.from(syncedProducts) } },
  });

  const message = `Synced ${variantUpserts} variants from ${syncedProducts.size} products (${pages + 1} page${pages ? "s" : ""}).`;
  return json({ ok: true, synced: variantUpserts, productsSeen: syncedProducts.size, pages: pages + 1, message });
};

export default function SyncProducts() {
  return null; // action-only route
}