import { Router } from "express";
import { query } from "../db.js";
import { DomainError } from "../domain/order-state.js";
import { createOrderSchema } from "../schemas.js";
import {
  cancelOrder,
  confirmOrder,
  createOrder,
  getOrder,
  releaseOrder,
  reserveOrder,
  startOrder,
  validateOrder,
} from "../services/order-service.js";
import { actorFrom, asyncHandler } from "./helpers.js";

export const ordersRouter = Router();

ordersRouter.get("/", asyncHandler(async (request, response) => {
  const status = String(request.query.status ?? "").trim();
  const search = String(request.query.q ?? "").trim();
  const rows = await query(
    `SELECT o.order_number, o.order_type, p.plant_code, o.status, o.priority,
            o.requested_at, o.due_at, o.created_by, o.updated_at,
            count(i.id)::integer AS item_count, COALESCE(sum(i.quantity), 0) AS total_quantity
       FROM business_order o
       JOIN plant p ON p.id = o.plant_id
       LEFT JOIN business_order_item i ON i.order_id = o.id
      WHERE ($1 = '' OR o.status = $1)
        AND ($2 = '' OR o.order_number ILIKE '%' || $2 || '%' OR o.created_by ILIKE '%' || $2 || '%')
      GROUP BY o.id, p.plant_code ORDER BY o.created_at DESC LIMIT 100`,
    [status, search],
  );
  response.json({ items: rows });
}));

ordersRouter.get("/:orderNumber", asyncHandler(async (request, response) => {
  response.json(await getOrder(String(request.params.orderNumber ?? "")));
}));

ordersRouter.post("/", asyncHandler(async (request, response) => {
  const parsed = createOrderSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new DomainError("VALIDATION_ERROR", "La orden contiene datos inválidos.", 422, parsed.error.flatten());
  }
  response.status(201).json(await createOrder(parsed.data));
}));

const actions = {
  validate: validateOrder,
  reserve: reserveOrder,
  release: releaseOrder,
  start: startOrder,
  confirm: confirmOrder,
  cancel: cancelOrder,
} as const;

for (const [action, operation] of Object.entries(actions)) {
  ordersRouter.post(`/:orderNumber/${action}`, asyncHandler(async (request, response) => {
    response.json(await operation(String(request.params.orderNumber ?? ""), actorFrom(request)));
  }));
}
