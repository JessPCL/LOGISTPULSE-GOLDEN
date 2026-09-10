import { Router } from "express";
import { query } from "../db.js";
import { asyncHandler } from "./helpers.js";

export const inventoryRouter = Router();

inventoryRouter.get("/", asyncHandler(async (request, response) => {
  const search = String(request.query.q ?? "").trim();
  const location = String(request.query.location ?? "").trim();
  const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 100);
  const offset = Math.max(Number(request.query.offset ?? 0), 0);
  const rows = await query(
    `SELECT location_code, material_code, description, batch_number, quality_status,
            quantity_on_hand, quantity_reserved, quantity_available, updated_at
       FROM inventory_available_v
      WHERE ($1 = '' OR material_code ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')
        AND ($2 = '' OR location_code = $2)
      ORDER BY material_code, location_code LIMIT $3 OFFSET $4`,
    [search, location, limit, offset],
  );
  const summary = await query(
    `SELECT location_code, count(*)::integer AS sku_count,
            sum(quantity_available) AS available_units,
            sum(quantity_reserved) AS reserved_units
       FROM inventory_available_v GROUP BY location_code ORDER BY location_code`,
  );
  response.json({ items: rows, summary, limit, offset });
}));

inventoryRouter.get("/availability", asyncHandler(async (request, response) => {
  const materialCode = String(request.query.materialCode ?? "").trim();
  const locationCode = String(request.query.locationCode ?? "").trim();
  const rows = await query(
    `SELECT material_code, location_code, sum(quantity_available) AS quantity_available
       FROM inventory_available_v
      WHERE material_code = $1 AND location_code = $2 AND quality_status = 'RELEASED'
      GROUP BY material_code, location_code`,
    [materialCode, locationCode],
  );
  response.json(rows[0] ?? { material_code: materialCode, location_code: locationCode, quantity_available: 0 });
}));

