import { Router } from "express";
import { query } from "../db.js";
import { asyncHandler } from "./helpers.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", asyncHandler(async (_request, response) => {
  const [orderCounts, inventory, tasks, movements, recentOrders] = await Promise.all([
    query<{ status: string; count: string }>(
      "SELECT status, count(*)::text AS count FROM business_order GROUP BY status",
    ),
    query<{ total_skus: string; available_units: string; reserved_units: string; low_stock: string }>(
      `SELECT count(*)::text AS total_skus,
              COALESCE(sum(quantity_on_hand - quantity_reserved), 0)::text AS available_units,
              COALESCE(sum(quantity_reserved), 0)::text AS reserved_units,
              count(*) FILTER (WHERE quantity_on_hand - quantity_reserved < 100)::text AS low_stock
         FROM inventory_balance`,
    ),
    query<{ open_tasks: string }>(
      "SELECT count(*)::text AS open_tasks FROM warehouse_task WHERE status IN ('RELEASED','IN_PROGRESS')",
    ),
    query<{ today: string }>(
      "SELECT count(*)::text AS today FROM material_document WHERE posted_at::date = CURRENT_DATE",
    ),
    query(
      `SELECT o.order_number, o.status, o.priority, o.created_at, o.due_at,
              count(i.id)::integer AS item_count,
              COALESCE(sum(i.quantity), 0) AS total_quantity
         FROM business_order o
         LEFT JOIN business_order_item i ON i.order_id = o.id
        GROUP BY o.id ORDER BY o.created_at DESC LIMIT 6`,
    ),
  ]);
  const counts = Object.fromEntries(orderCounts.map((item) => [item.status, Number(item.count)]));
  response.json({
    orders: counts,
    inventory: inventory[0],
    openTasks: Number(tasks[0]?.open_tasks ?? 0),
    movementsToday: Number(movements[0]?.today ?? 0),
    recentOrders,
  });
}));

