// app/routes/app.counts.csv.jsx
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  // gate if you only want admins to download; loosen if staff can download
  await authenticate.admin(request);

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");         // "one" | "all"
  const id = url.searchParams.get("id");             // countId when mode=one

  const toCsv = (rows) => {
    const header = [
      "Count ID",
      "Product Title",
      "Variant Title",
      "Counted",
      "User (email)",
      "Edited At (ISO)",
    ].join(",");
    const lines = rows.map((r) =>
      [
        r.id,
        csvEscape(r.variant?.product?.title ?? ""),
        csvEscape(r.variant?.title ?? ""),
        r.counted ?? "",
        csvEscape(r.user?.email || "Unknown"),
        new Date(r.createdAt).toISOString(),
      ].join(","),
    );
    return [header, ...lines].join("\n");
  };

  if (mode === "one") {
    if (!id) return json({ error: "Missing id" }, { status: 400 });
    const row = await prisma.physicalCount.findFirst({
      where: { id },
      select: {
        id: true,
        counted: true,
        createdAt: true,
        user: { select: { email: true } },
        variant: { select: { title: true, product: { select: { title: true } } } },
      },
    });
    if (!row) return json({ error: "Not found" }, { status: 404 });

    const csv = toCsv([row]);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="count-${row.id}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // default: all (latest 200)
  const rows = await prisma.physicalCount.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      counted: true,
      createdAt: true,
      user: { select: { email: true } },
      variant: { select: { title: true, product: { select: { title: true } } } },
    },
  });

  const csv = toCsv(rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="counts-latest.csv"`,
      "Cache-Control": "no-store",
    },
  });
};

function csvEscape(s) {
  if (s == null) return "";
  const str = String(s);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}