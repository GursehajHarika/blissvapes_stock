// app/graphql/variants.js
export const VARIANTS_QUERY = /* GraphQL */ `
  query Variants($cursor: String) {
    productVariants(first: 100, after: $cursor, sortKey: ID) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        legacyResourceId
        title
        sku
        price
        compareAtPrice
        position
        availableForSale
        createdAt
        updatedAt
        inventoryQuantity  # fallback total if no per-location levels

        product {
          id
          handle
          title
          vendor
          productType
          status
          tags
          createdAt
          updatedAt
          publishedAt
        }

        inventoryItem {
          id
          tracked
          inventoryLevels(first: 50) {   # keep this modest; we paginate variants anyway
            nodes {
              location { id name }
              quantities(names: ["on_hand","committed","reserved","available"]) {
                name
                quantity
              }
            }
          }
        }
      }
    }
  }
`;