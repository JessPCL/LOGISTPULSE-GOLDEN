import { Router } from "express";
import { query } from "../db.js";
import { asyncHandler } from "./helpers.js";

export const integrationRouter = Router();

integrationRouter.get("/events", asyncHandler(async (request, response) => {
  const status = String(request.query.status ?? "").trim();
  const rows = await query(
    `SELECT id, aggregate_type, aggregate_id, event_type, payload, status,
            occurred_at, published_at, retry_count, last_error
       FROM integration_outbox
      WHERE ($1 = '' OR status = $1)
      ORDER BY occurred_at DESC LIMIT 100`,
    [status],
  );
  response.json({ items: rows });
}));

integrationRouter.get("/audit", asyncHandler(async (request, response) => {
  const entityId = String(request.query.entityId ?? "").trim();
  const rows = await query(
    `SELECT actor, action, entity_type, entity_id, before_data, after_data,
            correlation_id, occurred_at
       FROM audit_log
      WHERE ($1 = '' OR entity_id = $1)
      ORDER BY occurred_at DESC LIMIT 100`,
    [entityId],
  );
  response.json({ items: rows });
}));

