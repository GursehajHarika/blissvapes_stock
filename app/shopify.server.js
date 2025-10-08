// app/shopify.server.js
import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  DeliveryMethod,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

/** Turn numeric REST IDs into GIDs (used for InventoryItem/Location, etc.) */
const toGid = (type, numericId) => `gid://shopify/${type}/${numericId}`;

/** Upsert product & variants from a REST product payload */
async function upsertProductFromWebhook(_shop, payload) {
  const productGid = payload.admin_graphql_api_id; // "gid://shopify/Product/xxx"
  const tagsCsv = Array.isArray(payload.tags) ? payload.tags.join(",") : payload.tags || null;

  // Upsert Product
  const product = await prisma.product.upsert({
    where: { shopifyGid: productGid },
    create: {
      shopifyGid: productGid,
      handle: payload.handle,
      title: payload.title || "(Untitled)",
      vendor: payload.vendor || null,
      productType: payload.product_type || null,
      status: payload.status || null,
      tagsCsv,
      createdAt: new Date(payload.created_at),
      updatedAt: new Date(payload.updated_at),
      publishedAt: payload.published_at ? new Date(payload.published_at) : null,
    },
    update: {
      handle: payload.handle,
      title: payload.title || "(Untitled)",
      vendor: payload.vendor || null,
      productType: payload.product_type || null,
      status: payload.status || null,
      tagsCsv,
      updatedAt: new Date(payload.updated_at),
      publishedAt: payload.published_at ? new Date(payload.published_at) : null,
    },
    select: { id: true },
  });

  // Upsert Variants
  if (Array.isArray(payload.variants)) {
    for (const v of payload.variants) {
      const variantGid = v.admin_graphql_api_id; // "gid://shopify/ProductVariant/xxx"
      const inventoryItemGid = toGid("InventoryItem", v.inventory_item_id);

      await prisma.productVariant.upsert({
        where: { shopifyGid: variantGid },
        create: {
          shopifyGid: variantGid,
          legacyId: v.id ? BigInt(v.id) : null,
          productId: product.id,
          title: v.title || null,
          sku: v.sku || null,
          price: v.price != null ? v.price : "0.00",
          compareAtPrice: v.compare_at_price != null ? v.compare_at_price : null,
          position: v.position ?? null,
          availableForSale: v.available ?? null,
          createdAt: v.created_at ? new Date(v.created_at) : new Date(),
          updatedAt: v.updated_at ? new Date(v.updated_at) : new Date(),
          inventoryItemGid, // <-- make sure your schema has this column
        },
        update: {
          title: v.title || null,
          sku: v.sku || null,
          price: v.price != null ? v.price : "0.00",
          compareAtPrice: v.compare_at_price != null ? v.compare_at_price : null,
          position: v.position ?? null,
          availableForSale: v.available ?? null,
          updatedAt: v.updated_at ? new Date(v.updated_at) : new Date(),
          inventoryItemGid,
        },
      });
    }
  }
}

/** Handle inventory level updates and record delta as SaleEvent */
async function applyInventoryLevelUpdate(_shop, payload) {
  const inventoryItemGid = toGid("InventoryItem", payload.inventory_item_id);
  const locationGid = toGid("Location", payload.location_id);
  const newAvailable = Number(payload.available);

  const variant = await prisma.productVariant.findFirst({
    where: { inventoryItemGid },
    select: { id: true },
  });
  if (!variant) return; // if product webhook hasn’t run yet

  const existing = await prisma.variantInventoryLevel.findFirst({
    where: { variantId: variant.id, locationGid },
  });

  if (existing) {
    const prev = Number(existing.available ?? 0);
    const delta = newAvailable - prev;

    await prisma.variantInventoryLevel.update({
      where: { id: existing.id },
      data: { available: newAvailable },
    });

    if (delta !== 0) {
      await prisma.saleEvent.create({
        data: {
          variantId: variant.id,
          quantity: delta, // +ve received, -ve sold
          occurredAt: new Date(),
        },
      });
    }
  } else {
    await prisma.variantInventoryLevel.create({
      data: {
        variantId: variant.id,
        locationGid,
        locationName: String(payload.location_id), // optional placeholder
        available: newAvailable,
      },
    });

    if (newAvailable !== 0) {
      await prisma.saleEvent.create({
        data: {
          variantId: variant.id,
          quantity: newAvailable,
          occurredAt: new Date(),
        },
      });
    }
  }
}

/** Delete product (cascades via Prisma schema) */
async function deleteProductFromWebhook(_shop, payload) {
  const productGid = toGid("Product", payload.id);
  await prisma.product.delete({ where: { shopifyGid: productGid } }).catch(() => {});
}

/** Create the Shopify app */
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

/**
 * Define your webhook handlers here (Remix style).
 * Register these during auth with: await registerWebhooks({ session, webhooks: webhookHandlers })
 */
export const webhookHandlers = {
  APP_UNINSTALLED: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks",
    callback: async (_topic, shop, _body) => {
      // Clean up sessions for the shop if you want
      await prisma.session.deleteMany({ where: { shop } }).catch(() => {});
    },
  },

  PRODUCTS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks",
    callback: async (_topic, shop, body) => {
      const payload = JSON.parse(body);
      await upsertProductFromWebhook(shop, payload);
    },
  },

  PRODUCTS_UPDATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks",
    callback: async (_topic, shop, body) => {
      const payload = JSON.parse(body);
      await upsertProductFromWebhook(shop, payload);
    },
  },

  PRODUCTS_DELETE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks",
    callback: async (_topic, shop, body) => {
      const payload = JSON.parse(body);
      await deleteProductFromWebhook(shop, payload);
    },
  },

  INVENTORY_LEVELS_UPDATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: "/webhooks",
    callback: async (_topic, shop, body) => {
      const payload = JSON.parse(body);
      await applyInventoryLevelUpdate(shop, payload);
    },
  },
};

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

/** Optional helper to grab an admin client in routes */
export const getAdminClient = async (request) => {
  const { admin, session } = await authenticate.admin(request);
  return { admin, session };
};