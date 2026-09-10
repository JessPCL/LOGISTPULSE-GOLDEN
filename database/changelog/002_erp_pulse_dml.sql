--liquibase formatted sql

--changeset erp-pulse:002
INSERT INTO company (company_code, legal_name, tax_id)
VALUES ('PULSE', 'PULSE Industries S.A.', '1799999999001');

INSERT INTO plant (company_id, plant_code, name)
SELECT id, 'PLANTA-QUITO', 'Planta Quito' FROM company WHERE company_code = 'PULSE';

INSERT INTO warehouse (plant_id, warehouse_code, name)
SELECT id, 'ALM-01', 'Almacén central' FROM plant WHERE plant_code = 'PLANTA-QUITO';

INSERT INTO storage_location (warehouse_id, location_code, name, location_type, x_coordinate, y_coordinate)
SELECT w.id, v.code, v.name, v.type, v.x, v.y
FROM warehouse w
CROSS JOIN (VALUES
  ('RACK-A01', 'Rack A-01', 'RACK', 90.0, 110.0),
  ('RACK-A02', 'Rack A-02', 'RACK', 90.0, 260.0),
  ('RACK-B01', 'Rack B-01', 'RACK', 90.0, 430.0),
  ('STAGING-01', 'Staging 01', 'STAGING', 760.0, 160.0),
  ('STAGING-02', 'Staging 02', 'STAGING', 760.0, 315.0),
  ('DOCK-01', 'Muelle 01', 'DOCK', 930.0, 235.0),
  ('PRODUCTION-B', 'Producción B', 'PRODUCTION', 540.0, 565.0),
  ('RECEIVING-01', 'Recepción 01', 'RECEIVING', 900.0, 540.0)
) AS v(code, name, type, x, y)
WHERE w.warehouse_code = 'ALM-01';

INSERT INTO unit_of_measure (uom_code, name) VALUES
('EA', 'Unidad'), ('BOX', 'Caja'), ('KG', 'Kilogramo'), ('L', 'Litro');

INSERT INTO business_partner (partner_code, partner_type, legal_name, tax_id) VALUES
('INTERNAL-PULSE', 'INTERNAL', 'PULSE Industries', '1799999999001'),
('SUP-0001', 'SUPPLIER', 'Proveedor Andino S.A.', '1791111111001'),
('CUS-0001', 'CUSTOMER', 'Cliente Industrial S.A.', '1792222222001');

INSERT INTO material (material_code, description, base_uom_id, category, weight_kg)
SELECT
  'MAT-' || lpad(g::text, 6, '0'),
  CASE g % 5
    WHEN 0 THEN 'Producto terminado ' || g
    WHEN 1 THEN 'Materia prima ' || g
    WHEN 2 THEN 'Material de empaque ' || g
    WHEN 3 THEN 'Repuesto industrial ' || g
    ELSE 'Suministro operativo ' || g
  END,
  (SELECT id FROM unit_of_measure WHERE uom_code = CASE WHEN g % 11 = 0 THEN 'KG' ELSE 'EA' END),
  CASE g % 5
    WHEN 0 THEN 'PRODUCTO TERMINADO'
    WHEN 1 THEN 'MATERIA PRIMA'
    WHEN 2 THEN 'EMPAQUE'
    WHEN 3 THEN 'REPUESTO'
    ELSE 'SUMINISTRO'
  END,
  round((0.10 + (g % 500) / 20.0)::numeric, 3)
FROM generate_series(1, 10000) AS g;

INSERT INTO material_batch (material_id, batch_number, manufactured_at, expires_at, quality_status)
SELECT
  m.id,
  'LOT-' || substring(m.material_code FROM 5),
  CURRENT_DATE - ((m.id % 120)::integer),
  CURRENT_DATE + 365 + ((m.id % 180)::integer),
  CASE WHEN m.id % 97 = 0 THEN 'INSPECTION' ELSE 'RELEASED' END
FROM material m;

INSERT INTO inventory_balance (storage_location_id, batch_id, quantity_on_hand, quantity_reserved)
SELECT
  (SELECT id FROM storage_location WHERE location_code = CASE
    WHEN mb.id % 3 = 0 THEN 'RACK-A02'
    WHEN mb.id % 3 = 1 THEN 'RACK-A01'
    ELSE 'RACK-B01' END),
  mb.id,
  100 + (mb.id % 900),
  0
FROM material_batch mb;

INSERT INTO business_order (order_number, order_type, plant_id, partner_id, status, priority, due_at, created_by)
SELECT 'ORD-000001', 'STOCK_TRANSFER', p.id, bp.id, 'DRAFT', 'HIGH', CURRENT_TIMESTAMP + INTERVAL '2 hours', 'roberto@pulse.local'
FROM plant p CROSS JOIN business_partner bp
WHERE p.plant_code = 'PLANTA-QUITO' AND bp.partner_code = 'INTERNAL-PULSE';

INSERT INTO business_order_item (order_id, line_number, material_id, quantity, source_location_id, destination_location_id)
SELECT o.id, 10, m.id, 50, source.id, destination.id
FROM business_order o
JOIN material m ON m.material_code = 'MAT-000001'
JOIN storage_location source ON source.location_code = 'RACK-A01'
JOIN storage_location destination ON destination.location_code = 'STAGING-01'
WHERE o.order_number = 'ORD-000001';

INSERT INTO business_order (order_number, order_type, plant_id, partner_id, status, priority, requested_at, due_at, created_by)
SELECT 'ORD-000002', 'STOCK_TRANSFER', p.id, bp.id, 'COMPLETED', 'NORMAL', CURRENT_TIMESTAMP - INTERVAL '3 hours', CURRENT_TIMESTAMP - INTERVAL '1 hour', 'operador@pulse.local'
FROM plant p CROSS JOIN business_partner bp
WHERE p.plant_code = 'PLANTA-QUITO' AND bp.partner_code = 'INTERNAL-PULSE';

INSERT INTO business_order_item (order_id, line_number, material_id, quantity, source_location_id, destination_location_id)
SELECT o.id, 10, m.id, 20, source.id, destination.id
FROM business_order o
JOIN material m ON m.material_code = 'MAT-000002'
JOIN storage_location source ON source.location_code = 'RACK-A02'
JOIN storage_location destination ON destination.location_code = 'PRODUCTION-B'
WHERE o.order_number = 'ORD-000002';

INSERT INTO business_order (order_number, order_type, plant_id, partner_id, status, priority, due_at, created_by)
SELECT 'ORD-000003', 'STOCK_TRANSFER', p.id, bp.id, 'VALIDATED', 'CRITICAL', CURRENT_TIMESTAMP + INTERVAL '30 minutes', 'supervisor@pulse.local'
FROM plant p CROSS JOIN business_partner bp
WHERE p.plant_code = 'PLANTA-QUITO' AND bp.partner_code = 'INTERNAL-PULSE';

INSERT INTO business_order_item (order_id, line_number, material_id, quantity, source_location_id, destination_location_id)
SELECT o.id, 10, m.id, 75, source.id, destination.id
FROM business_order o
JOIN material m ON m.material_code = 'MAT-000003'
JOIN storage_location source ON source.location_code = 'RACK-A02'
JOIN storage_location destination ON destination.location_code = 'DOCK-01'
WHERE o.order_number = 'ORD-000003';

INSERT INTO material_document (document_number, movement_type, order_id, posted_at, posted_by)
SELECT 'MATDOC-000001', '311', id, CURRENT_TIMESTAMP - INTERVAL '1 hour', 'operador@pulse.local'
FROM business_order WHERE order_number = 'ORD-000002';

INSERT INTO material_movement_item (document_id, line_number, material_id, batch_id, quantity, source_location_id, destination_location_id)
SELECT d.id, 10, i.material_id, mb.id, i.quantity, i.source_location_id, i.destination_location_id
FROM material_document d
JOIN business_order o ON o.id = d.order_id
JOIN business_order_item i ON i.order_id = o.id
JOIN material_batch mb ON mb.material_id = i.material_id
WHERE d.document_number = 'MATDOC-000001';

INSERT INTO audit_log (actor, action, entity_type, entity_id, after_data)
VALUES ('system', 'SEED_DATABASE', 'SYSTEM', 'ERP-PULSE-V1', jsonb_build_object('materials', 10000, 'version', '1.0.0'));

--rollback DELETE FROM audit_log; DELETE FROM material_movement_item; DELETE FROM material_document; DELETE FROM business_order_item; DELETE FROM business_order; DELETE FROM inventory_balance; DELETE FROM material_batch; DELETE FROM material; DELETE FROM business_partner; DELETE FROM unit_of_measure; DELETE FROM storage_location; DELETE FROM warehouse; DELETE FROM plant; DELETE FROM company;

