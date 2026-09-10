--liquibase formatted sql

--changeset erp-pulse:004
ALTER TABLE business_order ADD CONSTRAINT ck_order_status
CHECK (status IN ('DRAFT','VALIDATED','RESERVED','RELEASED','IN_EXECUTION','COMPLETED','CANCELLED'));

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_updated_at
BEFORE UPDATE ON business_order
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_inventory_updated_at
BEFORE UPDATE ON inventory_balance
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

--rollback DROP TRIGGER trg_inventory_updated_at ON inventory_balance; DROP TRIGGER trg_order_updated_at ON business_order; DROP FUNCTION set_updated_at(); ALTER TABLE business_order DROP CONSTRAINT ck_order_status;

