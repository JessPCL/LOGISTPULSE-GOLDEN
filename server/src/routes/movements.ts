import { Router } from "express";
import { query } from "../db.js";
import { asyncHandler } from "./helpers.js";

export const movementsRouter = Router();

movementsRouter.get("/", asyncHandler(async (request, response) => {
  const movementType = String(request.query.type ?? "").trim();
  const rows = await query(
    `SELECT d.document_number, d.movement_type, d.posted_at, d.posted_by,
            o.order_number, i.line_number, m.material_code, m.description,
            mb.batch_number, i.quantity,
            source.location_code AS source_location,
            destination.location_code AS destination_location
       FROM material_document d
       LEFT JOIN business_order o ON o.id = d.order_id
       JOIN material_movement_item i ON i.document_id = d.id
       JOIN material m ON m.id = i.material_id
       LEFT JOIN material_batch mb ON mb.id = i.batch_id
       LEFT JOIN storage_location source ON source.id = i.source_location_id
       LEFT JOIN storage_location destination ON destination.id = i.destination_location_id
      WHERE ($1 = '' OR d.movement_type = $1)
      ORDER BY d.posted_at DESC, i.line_number LIMIT 100`,
    [movementType],
  );
  response.json({ items: rows });
}));

