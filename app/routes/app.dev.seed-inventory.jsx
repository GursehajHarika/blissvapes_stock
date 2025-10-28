import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/** Sets track = true and puts qty=25 on first active location for all variants */
export const action = async () => {
  const { admin } = await authenticate.admin();

  // 1) get active locations
  const locResp = await admin.graphql(`
    query {
      locations(first: 1, includeInactive: false) {
        nodes { id name }
      }
    }
  `);
  const loc = (await locResp.json())?.data?.locations?.nodes?.[0];
  if (!loc) return json({ ok: false, error: "No active locations" }, { status: 400 });

  // 2) get variants + inventoryItems (paginate if you have >250)
  const varsResp = await admin.graphql(`
    query {
      productVariants(first: 250) {
        nodes { id, inventoryItem { id, tracked } }
      }
    }
  `);
  const variants = (await varsResp.json())?.data?.productVariants?.nodes ?? [];

  // 3) Prepare set-on-hand input
  const items = variants.map(v => ({
    inventoryItemId: v.inventoryItem.id,
    locationId: loc.id,
    onHand: 25,       // seed value; change as you like
    reason: "correction",
  }));

  // 4) Ensure tracking + set quantities
  const mutation = `
    mutation Seed($trackIds: [ID!]!, $input: [InventorySetOnHandQuantitiesInput!]!) {
      inventoryBulkToggleTracking(inventoryItemIds: $trackIds, tracked: true) {
        userErrors { field message }
      }
      inventorySetOnHandQuantities(input: $input) {
        userErrors { field message }
      }
    }
  `;

  const m = await admin.graphql(mutation, {
    variables: { trackIds: variants.map(v => v.inventoryItem.id), input: items },
  });
  const jsonOut = await m.json();
  return json({ ok: true, location: loc, result: jsonOut });
};

export default function Seed() { return null; }