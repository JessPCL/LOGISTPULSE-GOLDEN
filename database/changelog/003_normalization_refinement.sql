--liquibase formatted sql

--changeset erp-pulse:003
COMMENT ON TABLE inventory_balance IS 'Saldo normalizado por ubicación y lote. El material se obtiene mediante material_batch.';
COMMENT ON TABLE order_item_batch_allocation IS 'Separa el material solicitado del lote seleccionado durante la reserva.';
COMMENT ON COLUMN inventory_balance.batch_id IS 'batch_id determina material_id; evita almacenar material_id de forma redundante.';
COMMENT ON TABLE integration_outbox IS 'Eventos insertados en la misma transacción del cambio empresarial.';

CREATE VIEW inventory_available_v AS
SELECT
  sl.location_code,
  m.material_code,
  m.description,
  mb.batch_number,
  mb.quality_status,
  ib.quantity_on_hand,
  ib.quantity_reserved,
  ib.quantity_on_hand - ib.quantity_reserved AS quantity_available,
  ib.updated_at
FROM inventory_balance ib
JOIN storage_location sl ON sl.id = ib.storage_location_id
JOIN material_batch mb ON mb.id = ib.batch_id
JOIN material m ON m.id = mb.material_id;

--rollback DROP VIEW inventory_available_v;

