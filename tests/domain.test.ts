import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canTransition, assertTransition, DomainError } from "../server/src/domain/order-state.js";
import { appendGs1CheckDigit, buildSscc, isValidSscc } from "../server/src/domain/sscc.js";
import { createOrderSchema } from "../server/src/schemas.js";

test("flujo vertical permite las cinco transiciones empresariales", () => {
  assert.equal(canTransition("DRAFT", "VALIDATED"), true);
  assert.equal(canTransition("VALIDATED", "RESERVED"), true);
  assert.equal(canTransition("RESERVED", "RELEASED"), true);
  assert.equal(canTransition("RELEASED", "IN_EXECUTION"), true);
  assert.equal(canTransition("IN_EXECUTION", "COMPLETED"), true);
});

test("una orden completada no puede volver a ejecución", () => {
  assert.throws(() => assertTransition("COMPLETED", "IN_EXECUTION"), DomainError);
});

test("SSCC generado contiene 18 dígitos y dígito verificador válido", () => {
  const sscc = buildSscc(1);
  assert.match(sscc, /^\d{18}$/);
  assert.equal(isValidSscc(sscc), true);
  assert.equal(appendGs1CheckDigit(sscc.slice(0, 17)), sscc);
});

test("validador rechaza origen igual al destino", () => {
  const result = createOrderSchema.safeParse({
    plantCode: "PLANTA-QUITO",
    priority: "HIGH",
    createdBy: "operador@pulse.local",
    items: [{
      lineNumber: 10,
      materialCode: "MAT-000001",
      quantity: 50,
      sourceLocation: "RACK-A01",
      destinationLocation: "RACK-A01",
    }],
  });
  assert.equal(result.success, false);
});

test("DDL conserva la normalización de inventory_balance", async () => {
  const ddl = await readFile(new URL("../database/changelog/001_erp_pulse_ddl.sql", import.meta.url), "utf8");
  const table = ddl.match(/CREATE TABLE inventory_balance \(([\s\S]*?)\n\);/)?.[1] ?? "";
  assert.match(table, /storage_location_id/);
  assert.match(table, /batch_id/);
  assert.doesNotMatch(table, /material_id/);
  assert.match(table, /quantity_reserved <= quantity_on_hand/);
});

test("DML genera al menos diez mil materiales", async () => {
  const dml = await readFile(new URL("../database/changelog/002_erp_pulse_dml.sql", import.meta.url), "utf8");
  assert.match(dml, /generate_series\(1, 10000\)/);
});

