import type { PoolClient } from "pg";
import type { z } from "zod";
import { query, transaction } from "../db.js";
import { assertTransition, DomainError, type OrderStatus } from "../domain/order-state.js";
import { buildSscc } from "../domain/sscc.js";
import type { createOrderSchema } from "../schemas.js";

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

interface OrderRow {
  id: string;
  order_number: string;
  order_type: string;
  plant_code: string;
  status: OrderStatus;
  priority: string;
  requested_at: string;
  due_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
}

interface OrderItemRow {
  id: string;
  line_number: number;
  material_id: string;
  material_code: string;
  description: string;
  quantity: string;
  weight_kg: string;
  source_location_id: string;
  source_location: string;
  destination_location_id: string;
  destination_location: string;
}

async function lockOrder(client: PoolClient, orderNumber: string): Promise<OrderRow> {
  const result = await client.query<OrderRow>(
    `SELECT o.*, p.plant_code
       FROM business_order o
       JOIN plant p ON p.id = o.plant_id
      WHERE o.order_number = $1
      FOR UPDATE OF o`,
    [orderNumber],
  );
  const order = result.rows[0];
  if (!order) throw new DomainError("ORDER_NOT_FOUND", `No existe la orden ${orderNumber}.`, 404);
  return order;
}

async function audit(
  client: PoolClient,
  actor: string,
  action: string,
  entityId: string,
  beforeData: unknown,
  afterData: unknown,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (actor, action, entity_type, entity_id, before_data, after_data)
     VALUES ($1, $2, 'BUSINESS_ORDER', $3, $4::jsonb, $5::jsonb)`,
    [actor, action, entityId, JSON.stringify(beforeData), JSON.stringify(afterData)],
  );
}

async function outbox(
  client: PoolClient,
  aggregateId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO integration_outbox (aggregate_type, aggregate_id, event_type, payload)
     VALUES ('BUSINESS_ORDER', $1, $2, $3::jsonb)`,
    [aggregateId, eventType, JSON.stringify(payload)],
  );
}

async function setStatus(
  client: PoolClient,
  order: OrderRow,
  target: OrderStatus,
  actor: string,
): Promise<void> {
  assertTransition(order.status, target);
  await client.query(
    `UPDATE business_order SET status = $1, version = version + 1 WHERE id = $2`,
    [target, order.id],
  );
  await audit(client, actor, `ORDER_${target}`, order.order_number, { status: order.status }, { status: target });
}

export async function createOrder(input: CreateOrderInput): Promise<unknown> {
  const lines = new Set(input.items.map((item) => item.lineNumber));
  if (lines.size !== input.items.length) {
    throw new DomainError("DUPLICATE_LINE", "Los números de línea no pueden repetirse.");
  }

  const orderNumber = await transaction(async (client) => {
    const plantResult = await client.query<{ id: string }>(
      "SELECT id FROM plant WHERE plant_code = $1 AND active = TRUE",
      [input.plantCode],
    );
    const plant = plantResult.rows[0];
    if (!plant) throw new DomainError("PLANT_NOT_FOUND", `No existe la planta ${input.plantCode}.`, 404);

    const sequenceResult = await client.query<{ value: string }>("SELECT nextval('order_number_seq')::text AS value");
    const sequence = Number(sequenceResult.rows[0]?.value);
    const generatedOrderNumber = `ORD-${String(sequence).padStart(6, "0")}`;
    const dueAt = input.dueAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const orderResult = await client.query<{ id: string }>(
      `INSERT INTO business_order
        (order_number, order_type, plant_id, status, priority, due_at, created_by)
       VALUES ($1, 'STOCK_TRANSFER', $2, 'DRAFT', $3, $4, $5)
       RETURNING id`,
      [generatedOrderNumber, plant.id, input.priority, dueAt, input.createdBy],
    );
    const orderId = orderResult.rows[0]?.id;
    if (!orderId) throw new Error("No se pudo crear la orden.");

    for (const item of input.items) {
      const masterResult = await client.query<{
        material_id: string;
        source_id: string;
        destination_id: string;
      }>(
        `SELECT m.id AS material_id, source.id AS source_id, destination.id AS destination_id
           FROM material m
           JOIN storage_location source ON source.location_code = $2 AND source.active = TRUE
           JOIN warehouse sw ON sw.id = source.warehouse_id
           JOIN plant sp ON sp.id = sw.plant_id AND sp.id = $4
           JOIN storage_location destination ON destination.location_code = $3 AND destination.active = TRUE
           JOIN warehouse dw ON dw.id = destination.warehouse_id AND dw.plant_id = $4
          WHERE m.material_code = $1 AND m.active = TRUE`,
        [item.materialCode, item.sourceLocation, item.destinationLocation, plant.id],
      );
      const master = masterResult.rows[0];
      if (!master) {
        throw new DomainError(
          "MASTER_DATA_NOT_FOUND",
          `Revise material y ubicaciones de la línea ${item.lineNumber}.`,
          422,
        );
      }
      await client.query(
        `INSERT INTO business_order_item
          (order_id, line_number, material_id, quantity, source_location_id, destination_location_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.lineNumber, master.material_id, item.quantity, master.source_id, master.destination_id],
      );
    }

    await audit(client, input.createdBy, "ORDER_CREATED", generatedOrderNumber, null, {
      status: "DRAFT",
      priority: input.priority,
      items: input.items.length,
    });
    return generatedOrderNumber;
  });

  return getOrder(orderNumber);
}

export async function validateOrder(orderNumber: string, actor: string): Promise<unknown> {
  await transaction(async (client) => {
    const order = await lockOrder(client, orderNumber);
    assertTransition(order.status, "VALIDATED");
    const result = await client.query<{ total: string; valid: string }>(
      `SELECT count(*)::text AS total,
              count(*) FILTER (WHERE m.active = TRUE AND source.active = TRUE AND destination.active = TRUE)::text AS valid
         FROM business_order_item i
         JOIN material m ON m.id = i.material_id
         JOIN storage_location source ON source.id = i.source_location_id
         JOIN storage_location destination ON destination.id = i.destination_location_id
        WHERE i.order_id = $1`,
      [order.id],
    );
    const totals = result.rows[0];
    if (!totals || Number(totals.total) === 0 || Number(totals.valid) !== Number(totals.total)) {
      throw new DomainError("INVALID_ORDER_ITEMS", "La orden contiene líneas vacías o maestros inactivos.", 422);
    }
    await setStatus(client, order, "VALIDATED", actor);
  });
  return getOrder(orderNumber);
}

export async function reserveOrder(orderNumber: string, actor: string): Promise<unknown> {
  await transaction(async (client) => {
    const order = await lockOrder(client, orderNumber);
    assertTransition(order.status, "RESERVED");
    const itemResult = await client.query<OrderItemRow>(
      `SELECT i.id, i.line_number, i.material_id, m.material_code, m.description,
              i.quantity, m.weight_kg, i.source_location_id, source.location_code AS source_location,
              i.destination_location_id, destination.location_code AS destination_location
         FROM business_order_item i
         JOIN material m ON m.id = i.material_id
         JOIN storage_location source ON source.id = i.source_location_id
         JOIN storage_location destination ON destination.id = i.destination_location_id
        WHERE i.order_id = $1 ORDER BY i.line_number`,
      [order.id],
    );

    for (const item of itemResult.rows) {
      let remaining = Number(item.quantity);
      const balances = await client.query<{
        batch_id: string;
        available: string;
      }>(
        `SELECT ib.batch_id, (ib.quantity_on_hand - ib.quantity_reserved)::text AS available
           FROM inventory_balance ib
           JOIN material_batch mb ON mb.id = ib.batch_id
          WHERE ib.storage_location_id = $1
            AND mb.material_id = $2
            AND mb.quality_status = 'RELEASED'
            AND ib.quantity_on_hand > ib.quantity_reserved
          ORDER BY mb.expires_at NULLS LAST, mb.id
          FOR UPDATE OF ib`,
        [item.source_location_id, item.material_id],
      );

      const available = balances.rows.reduce((sum, balance) => sum + Number(balance.available), 0);
      if (available < remaining) {
        throw new DomainError(
          "INSUFFICIENT_INVENTORY",
          `Inventario insuficiente para ${item.material_code}. Disponible ${available}; solicitado ${remaining}.`,
          409,
          { materialCode: item.material_code, available, requested: remaining },
        );
      }

      for (const balance of balances.rows) {
        if (remaining <= 0) break;
        const quantity = Math.min(remaining, Number(balance.available));
        const allocationResult = await client.query<{ id: string }>(
          `INSERT INTO order_item_batch_allocation (order_item_id, batch_id, allocated_quantity)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [item.id, balance.batch_id, quantity],
        );
        const allocationId = allocationResult.rows[0]?.id;
        if (!allocationId) throw new Error("No se pudo crear la asignación de lote.");
        await client.query(
          `INSERT INTO inventory_reservation (allocation_id, storage_location_id, quantity)
           VALUES ($1, $2, $3)`,
          [allocationId, item.source_location_id, quantity],
        );
        await client.query(
          `UPDATE inventory_balance
              SET quantity_reserved = quantity_reserved + $1
            WHERE storage_location_id = $2 AND batch_id = $3`,
          [quantity, item.source_location_id, balance.batch_id],
        );
        remaining -= quantity;
      }
    }

    await setStatus(client, order, "RESERVED", actor);
  });
  return getOrder(orderNumber);
}

export async function releaseOrder(orderNumber: string, actor: string): Promise<unknown> {
  await transaction(async (client) => {
    const order = await lockOrder(client, orderNumber);
    assertTransition(order.status, "RELEASED");
    const itemResult = await client.query<OrderItemRow>(
      `SELECT i.id, i.line_number, i.material_id, m.material_code, m.description,
              i.quantity, m.weight_kg, i.source_location_id, source.location_code AS source_location,
              i.destination_location_id, destination.location_code AS destination_location
         FROM business_order_item i
         JOIN material m ON m.id = i.material_id
         JOIN storage_location source ON source.id = i.source_location_id
         JOIN storage_location destination ON destination.id = i.destination_location_id
        WHERE i.order_id = $1 ORDER BY i.line_number`,
      [order.id],
    );

    for (const item of itemResult.rows) {
      const sequenceResult = await client.query<{ task_seq: string; hu_seq: string }>(
        "SELECT nextval('warehouse_task_number_seq')::text AS task_seq, nextval('handling_unit_seq')::text AS hu_seq",
      );
      const values = sequenceResult.rows[0];
      if (!values) throw new Error("No se pudieron generar números logísticos.");
      const taskNumber = `WT-${String(values.task_seq).padStart(6, "0")}`;
      const handlingUnitCode = `PALLET-${String(values.hu_seq).padStart(6, "0")}`;
      const sscc = buildSscc(Number(values.hu_seq));
      const handlingResult = await client.query<{ id: string }>(
        `INSERT INTO handling_unit
          (handling_unit_code, sscc, status, gross_weight_kg)
         VALUES ($1, $2, 'ASSIGNED', $3)
         RETURNING id`,
        [handlingUnitCode, sscc, Number(item.weight_kg) * Number(item.quantity)],
      );
      const handlingUnitId = handlingResult.rows[0]?.id;
      await client.query(
        `INSERT INTO warehouse_task
          (task_number, order_item_id, handling_unit_id, source_location_id,
           destination_location_id, requested_quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [taskNumber, item.id, handlingUnitId, item.source_location_id, item.destination_location_id, item.quantity],
      );
      await outbox(client, order.order_number, "TransportRequested", {
        eventVersion: 1,
        orderNumber: order.order_number,
        orderItem: item.line_number,
        warehouseTask: taskNumber,
        materialCode: item.material_code,
        quantity: Number(item.quantity),
        handlingUnit: handlingUnitCode,
        sscc,
        sourceLocation: item.source_location,
        destinationLocation: item.destination_location,
        priority: order.priority,
      });
    }
    await setStatus(client, order, "RELEASED", actor);
  });
  return getOrder(orderNumber);
}

export async function startOrder(orderNumber: string, actor: string): Promise<unknown> {
  await transaction(async (client) => {
    const order = await lockOrder(client, orderNumber);
    assertTransition(order.status, "IN_EXECUTION");
    await client.query(
      `UPDATE warehouse_task
          SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP
        WHERE order_item_id IN (SELECT id FROM business_order_item WHERE order_id = $1)`,
      [order.id],
    );
    await client.query(
      `UPDATE handling_unit SET status = 'IN_TRANSIT'
        WHERE id IN (
          SELECT wt.handling_unit_id FROM warehouse_task wt
          JOIN business_order_item i ON i.id = wt.order_item_id
          WHERE i.order_id = $1
        )`,
      [order.id],
    );
    await outbox(client, order.order_number, "MissionStarted", {
      eventVersion: 1,
      orderNumber: order.order_number,
      startedAt: new Date().toISOString(),
    });
    await setStatus(client, order, "IN_EXECUTION", actor);
  });
  return getOrder(orderNumber);
}

export async function confirmOrder(orderNumber: string, actor: string): Promise<unknown> {
  await transaction(async (client) => {
    const order = await lockOrder(client, orderNumber);
    assertTransition(order.status, "COMPLETED");
    const sequenceResult = await client.query<{ value: string }>("SELECT nextval('material_document_seq')::text AS value");
    const documentNumber = `MATDOC-${String(sequenceResult.rows[0]?.value).padStart(6, "0")}`;
    const documentResult = await client.query<{ id: string }>(
      `INSERT INTO material_document (document_number, movement_type, order_id, posted_by)
       VALUES ($1, '311', $2, $3) RETURNING id`,
      [documentNumber, order.id, actor],
    );
    const documentId = documentResult.rows[0]?.id;
    if (!documentId) throw new Error("No se pudo crear el documento de material.");

    const reservationResult = await client.query<{
      reservation_id: string;
      batch_id: string;
      material_id: string;
      quantity: string;
      source_location_id: string;
      destination_location_id: string;
      line_number: number;
    }>(
      `SELECT r.id AS reservation_id, a.batch_id, i.material_id, r.quantity,
              r.storage_location_id AS source_location_id, i.destination_location_id, i.line_number
         FROM inventory_reservation r
         JOIN order_item_batch_allocation a ON a.id = r.allocation_id
         JOIN business_order_item i ON i.id = a.order_item_id
        WHERE i.order_id = $1 AND r.status = 'ACTIVE'
        ORDER BY i.line_number, r.id
        FOR UPDATE OF r`,
      [order.id],
    );
    if (!reservationResult.rows.length) {
      throw new DomainError("NO_ACTIVE_RESERVATION", "La orden no tiene reservas activas.", 409);
    }

    let movementLine = 10;
    for (const reservation of reservationResult.rows) {
      await client.query(
        `UPDATE inventory_balance
            SET quantity_on_hand = quantity_on_hand - $1,
                quantity_reserved = quantity_reserved - $1
          WHERE storage_location_id = $2 AND batch_id = $3`,
        [reservation.quantity, reservation.source_location_id, reservation.batch_id],
      );
      await client.query(
        `INSERT INTO inventory_balance (storage_location_id, batch_id, quantity_on_hand, quantity_reserved)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (storage_location_id, batch_id)
         DO UPDATE SET quantity_on_hand = inventory_balance.quantity_on_hand + EXCLUDED.quantity_on_hand`,
        [reservation.destination_location_id, reservation.batch_id, reservation.quantity],
      );
      await client.query(
        `INSERT INTO material_movement_item
          (document_id, line_number, material_id, batch_id, quantity, source_location_id, destination_location_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [documentId, movementLine, reservation.material_id, reservation.batch_id, reservation.quantity,
          reservation.source_location_id, reservation.destination_location_id],
      );
      await client.query(
        `UPDATE inventory_reservation
            SET status = 'CONSUMED', released_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [reservation.reservation_id],
      );
      movementLine += 10;
    }

    await client.query(
      `UPDATE warehouse_task SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
        WHERE order_item_id IN (SELECT id FROM business_order_item WHERE order_id = $1)`,
      [order.id],
    );
    await client.query(
      `UPDATE handling_unit SET status = 'DELIVERED'
        WHERE id IN (
          SELECT wt.handling_unit_id FROM warehouse_task wt
          JOIN business_order_item i ON i.id = wt.order_item_id
          WHERE i.order_id = $1
        )`,
      [order.id],
    );
    await outbox(client, order.order_number, "Movement311Confirmed", {
      eventVersion: 1,
      orderNumber: order.order_number,
      materialDocument: documentNumber,
      movementType: "311",
      completedAt: new Date().toISOString(),
    });
    await setStatus(client, order, "COMPLETED", actor);
  });
  return getOrder(orderNumber);
}

export async function cancelOrder(orderNumber: string, actor: string): Promise<unknown> {
  await transaction(async (client) => {
    const order = await lockOrder(client, orderNumber);
    assertTransition(order.status, "CANCELLED");
    const activeReservations = await client.query<{
      id: string;
      quantity: string;
      storage_location_id: string;
      batch_id: string;
    }>(
      `SELECT r.id, r.quantity, r.storage_location_id, a.batch_id
         FROM inventory_reservation r
         JOIN order_item_batch_allocation a ON a.id = r.allocation_id
         JOIN business_order_item i ON i.id = a.order_item_id
        WHERE i.order_id = $1 AND r.status = 'ACTIVE'
        FOR UPDATE OF r`,
      [order.id],
    );
    for (const reservation of activeReservations.rows) {
      await client.query(
        `UPDATE inventory_balance
            SET quantity_reserved = quantity_reserved - $1
          WHERE storage_location_id = $2 AND batch_id = $3`,
        [reservation.quantity, reservation.storage_location_id, reservation.batch_id],
      );
      await client.query(
        `UPDATE inventory_reservation
            SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [reservation.id],
      );
    }
    await client.query(
      `UPDATE warehouse_task SET status = 'CANCELLED'
        WHERE order_item_id IN (SELECT id FROM business_order_item WHERE order_id = $1)
          AND status = 'RELEASED'`,
      [order.id],
    );
    await client.query(
      `UPDATE handling_unit SET status = 'AVAILABLE'
        WHERE id IN (
          SELECT wt.handling_unit_id FROM warehouse_task wt
          JOIN business_order_item i ON i.id = wt.order_item_id
          WHERE i.order_id = $1 AND wt.handling_unit_id IS NOT NULL
        )`,
      [order.id],
    );
    if (["RELEASED"].includes(order.status)) {
      await outbox(client, order.order_number, "TransportCancelled", {
        eventVersion: 1,
        orderNumber: order.order_number,
        cancelledAt: new Date().toISOString(),
      });
    }
    await setStatus(client, order, "CANCELLED", actor);
  });
  return getOrder(orderNumber);
}

export async function getOrder(orderNumber: string): Promise<unknown> {
  const orders = await query<OrderRow>(
    `SELECT o.*, p.plant_code
       FROM business_order o JOIN plant p ON p.id = o.plant_id
      WHERE o.order_number = $1`,
    [orderNumber],
  );
  const order = orders[0];
  if (!order) throw new DomainError("ORDER_NOT_FOUND", `No existe la orden ${orderNumber}.`, 404);
  const items = await query(
    `SELECT i.line_number, m.material_code, m.description, i.quantity,
            source.location_code AS source_location,
            destination.location_code AS destination_location,
            COALESCE(sum(a.allocated_quantity), 0) AS allocated_quantity
       FROM business_order_item i
       JOIN material m ON m.id = i.material_id
       JOIN storage_location source ON source.id = i.source_location_id
       JOIN storage_location destination ON destination.id = i.destination_location_id
       LEFT JOIN order_item_batch_allocation a ON a.order_item_id = i.id
      WHERE i.order_id = $1
      GROUP BY i.id, m.material_code, m.description, source.location_code, destination.location_code
      ORDER BY i.line_number`,
    [order.id],
  );
  const tasks = await query(
    `SELECT wt.task_number, wt.status, wt.assigned_resource, wt.requested_quantity,
            hu.handling_unit_code, hu.sscc, hu.status AS handling_unit_status,
            source.location_code AS source_location, destination.location_code AS destination_location,
            wt.created_at, wt.started_at, wt.completed_at
       FROM warehouse_task wt
       JOIN business_order_item i ON i.id = wt.order_item_id
       LEFT JOIN handling_unit hu ON hu.id = wt.handling_unit_id
       JOIN storage_location source ON source.id = wt.source_location_id
       JOIN storage_location destination ON destination.id = wt.destination_location_id
      WHERE i.order_id = $1 ORDER BY wt.id`,
    [order.id],
  );
  const auditEntries = await query(
    `SELECT actor, action, before_data, after_data, occurred_at
       FROM audit_log WHERE entity_type = 'BUSINESS_ORDER' AND entity_id = $1
      ORDER BY occurred_at DESC`,
    [orderNumber],
  );
  return { ...order, items, tasks, audit: auditEntries };
}
