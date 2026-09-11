import { Router } from "express";
import { query } from "../db.js";
import { asyncHandler } from "./helpers.js";

export const materialsRouter = Router();

materialsRouter.get("/", asyncHandler(async (request, response) => {
  const search = String(request.query.q ?? "").trim();
  const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 100);
  const offset = Math.max(Number(request.query.offset ?? 0), 0);
  const rows = await query(
    `SELECT m.material_code, m.description, u.uom_code, m.category, m.weight_kg,
            m.active, count(mb.id)::integer AS batch_count
       FROM material m
       JOIN unit_of_measure u ON u.id = m.base_uom_id
       LEFT JOIN material_batch mb ON mb.material_id = m.id
      WHERE ($1 = '' OR m.material_code ILIKE '%' || $1 || '%' OR m.description ILIKE '%' || $1 || '%')
      GROUP BY m.id, u.uom_code
      ORDER BY m.material_code LIMIT $2 OFFSET $3`,
    [search, limit, offset],
  );
  const count = await query<{ total: string }>(
    `SELECT count(*)::text AS total FROM material
      WHERE ($1 = '' OR material_code ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')`,
    [search],
  );
  response.json({ items: rows, total: Number(count[0]?.total ?? 0), limit, offset });
}));

