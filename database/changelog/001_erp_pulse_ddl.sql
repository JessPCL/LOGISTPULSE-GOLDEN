--liquibase formatted sql

--changeset erp-pulse:001
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SEQUENCE order_number_seq START WITH 4;
CREATE SEQUENCE warehouse_task_number_seq START WITH 1;
CREATE SEQUENCE material_document_seq START WITH 2;
CREATE SEQUENCE handling_unit_seq START WITH 1;

CREATE TABLE company (
    id                  BIGSERIAL PRIMARY KEY,
    company_code        VARCHAR(12) NOT NULL UNIQUE,
    legal_name          VARCHAR(160) NOT NULL,
    tax_id              VARCHAR(32) NOT NULL UNIQUE,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE plant (
    id                  BIGSERIAL PRIMARY KEY,
    company_id          BIGINT NOT NULL REFERENCES company(id),
    plant_code          VARCHAR(20) NOT NULL UNIQUE,
    name                VARCHAR(120) NOT NULL,
    timezone            VARCHAR(50) NOT NULL DEFAULT 'America/Guayaquil',
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE warehouse (
    id                  BIGSERIAL PRIMARY KEY,
    plant_id            BIGINT NOT NULL REFERENCES plant(id),
    warehouse_code      VARCHAR(20) NOT NULL,
    name                VARCHAR(120) NOT NULL,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (plant_id, warehouse_code)
);

CREATE TABLE storage_location (
    id                  BIGSERIAL PRIMARY KEY,
    warehouse_id        BIGINT NOT NULL REFERENCES warehouse(id),
    location_code       VARCHAR(30) NOT NULL,
    name                VARCHAR(120) NOT NULL,
    location_type       VARCHAR(20) NOT NULL,
    x_coordinate        NUMERIC(12,3),
    y_coordinate        NUMERIC(12,3),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (warehouse_id, location_code),
    CONSTRAINT ck_location_type CHECK (location_type IN ('RACK','STAGING','DOCK','PRODUCTION','RECEIVING','SHIPPING'))
);

CREATE TABLE unit_of_measure (
    id                  BIGSERIAL PRIMARY KEY,
    uom_code            VARCHAR(8) NOT NULL UNIQUE,
    name                VARCHAR(50) NOT NULL
);

CREATE TABLE material (
    id                  BIGSERIAL PRIMARY KEY,
    material_code       VARCHAR(30) NOT NULL UNIQUE,
    description         VARCHAR(180) NOT NULL,
    base_uom_id         BIGINT NOT NULL REFERENCES unit_of_measure(id),
    category            VARCHAR(60) NOT NULL,
    weight_kg           NUMERIC(12,3) NOT NULL DEFAULT 0,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_material_weight CHECK (weight_kg >= 0)
);

CREATE TABLE material_batch (
    id                  BIGSERIAL PRIMARY KEY,
    material_id         BIGINT NOT NULL REFERENCES material(id),
    batch_number        VARCHAR(40) NOT NULL,
    manufactured_at     DATE,
    expires_at          DATE,
    quality_status      VARCHAR(20) NOT NULL DEFAULT 'RELEASED',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (material_id, batch_number),
    CONSTRAINT ck_batch_quality CHECK (quality_status IN ('RELEASED','BLOCKED','INSPECTION')),
    CONSTRAINT ck_batch_dates CHECK (expires_at IS NULL OR manufactured_at IS NULL OR expires_at >= manufactured_at)
);

CREATE TABLE business_partner (
    id                  BIGSERIAL PRIMARY KEY,
    partner_code        VARCHAR(30) NOT NULL UNIQUE,
    partner_type        VARCHAR(20) NOT NULL,
    legal_name          VARCHAR(180) NOT NULL,
    tax_id              VARCHAR(32),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_partner_type CHECK (partner_type IN ('CUSTOMER','SUPPLIER','INTERNAL'))
);

CREATE TABLE inventory_balance (
    storage_location_id BIGINT NOT NULL REFERENCES storage_location(id),
    batch_id            BIGINT NOT NULL REFERENCES material_batch(id),
    quantity_on_hand    NUMERIC(18,3) NOT NULL DEFAULT 0,
    quantity_reserved   NUMERIC(18,3) NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (storage_location_id, batch_id),
    CONSTRAINT ck_inventory_nonnegative CHECK (quantity_on_hand >= 0 AND quantity_reserved >= 0),
    CONSTRAINT ck_inventory_reserved CHECK (quantity_reserved <= quantity_on_hand)
);

CREATE TABLE business_order (
    id                  BIGSERIAL PRIMARY KEY,
    order_number        VARCHAR(30) NOT NULL UNIQUE,
    order_type          VARCHAR(30) NOT NULL,
    plant_id            BIGINT NOT NULL REFERENCES plant(id),
    partner_id          BIGINT REFERENCES business_partner(id),
    status              VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    priority            VARCHAR(12) NOT NULL DEFAULT 'NORMAL',
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_at              TIMESTAMPTZ,
    created_by          VARCHAR(120) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version             INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT ck_order_type CHECK (order_type IN ('STOCK_TRANSFER','PURCHASE','SALES')),
    CONSTRAINT ck_order_priority CHECK (priority IN ('CRITICAL','HIGH','NORMAL','LOW')),
    CONSTRAINT ck_order_due CHECK (due_at IS NULL OR due_at >= requested_at)
);

CREATE TABLE business_order_item (
    id                      BIGSERIAL PRIMARY KEY,
    order_id                BIGINT NOT NULL REFERENCES business_order(id) ON DELETE CASCADE,
    line_number             INTEGER NOT NULL,
    material_id             BIGINT NOT NULL REFERENCES material(id),
    quantity                NUMERIC(18,3) NOT NULL,
    source_location_id      BIGINT NOT NULL REFERENCES storage_location(id),
    destination_location_id BIGINT NOT NULL REFERENCES storage_location(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (order_id, line_number),
    CONSTRAINT ck_order_item_quantity CHECK (quantity > 0),
    CONSTRAINT ck_different_locations CHECK (source_location_id <> destination_location_id)
);

CREATE TABLE order_item_batch_allocation (
    id                  BIGSERIAL PRIMARY KEY,
    order_item_id       BIGINT NOT NULL REFERENCES business_order_item(id) ON DELETE CASCADE,
    batch_id            BIGINT NOT NULL REFERENCES material_batch(id),
    allocated_quantity  NUMERIC(18,3) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (order_item_id, batch_id),
    CONSTRAINT ck_allocation_quantity CHECK (allocated_quantity > 0)
);

CREATE TABLE inventory_reservation (
    id                  BIGSERIAL PRIMARY KEY,
    reservation_number  UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    allocation_id       BIGINT NOT NULL UNIQUE REFERENCES order_item_batch_allocation(id) ON DELETE CASCADE,
    storage_location_id BIGINT NOT NULL REFERENCES storage_location(id),
    quantity            NUMERIC(18,3) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    reserved_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at         TIMESTAMPTZ,
    CONSTRAINT ck_reservation_quantity CHECK (quantity > 0),
    CONSTRAINT ck_reservation_status CHECK (status IN ('ACTIVE','CONSUMED','RELEASED'))
);

CREATE TABLE handling_unit (
    id                  BIGSERIAL PRIMARY KEY,
    handling_unit_code  VARCHAR(40) NOT NULL UNIQUE,
    sscc                CHAR(18) NOT NULL UNIQUE,
    handling_unit_type  VARCHAR(20) NOT NULL DEFAULT 'PALLET',
    status              VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    gross_weight_kg     NUMERIC(12,3) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_handling_type CHECK (handling_unit_type IN ('PALLET','BOX','CONTAINER')),
    CONSTRAINT ck_handling_status CHECK (status IN ('AVAILABLE','ASSIGNED','IN_TRANSIT','DELIVERED')),
    CONSTRAINT ck_handling_weight CHECK (gross_weight_kg >= 0),
    CONSTRAINT ck_sscc_digits CHECK (sscc ~ '^[0-9]{18}$')
);

CREATE TABLE warehouse_task (
    id                      BIGSERIAL PRIMARY KEY,
    task_number             VARCHAR(30) NOT NULL UNIQUE,
    order_item_id           BIGINT NOT NULL REFERENCES business_order_item(id),
    handling_unit_id        BIGINT REFERENCES handling_unit(id),
    status                  VARCHAR(24) NOT NULL DEFAULT 'RELEASED',
    assigned_resource       VARCHAR(40),
    source_location_id      BIGINT NOT NULL REFERENCES storage_location(id),
    destination_location_id BIGINT NOT NULL REFERENCES storage_location(id),
    requested_quantity      NUMERIC(18,3) NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    CONSTRAINT ck_task_status CHECK (status IN ('RELEASED','IN_PROGRESS','COMPLETED','FAILED','CANCELLED')),
    CONSTRAINT ck_task_locations CHECK (source_location_id <> destination_location_id),
    CONSTRAINT ck_task_quantity CHECK (requested_quantity > 0)
);

CREATE TABLE material_document (
    id                  BIGSERIAL PRIMARY KEY,
    document_number     VARCHAR(30) NOT NULL UNIQUE,
    movement_type       VARCHAR(3) NOT NULL,
    order_id            BIGINT REFERENCES business_order(id),
    posted_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    posted_by           VARCHAR(120) NOT NULL,
    CONSTRAINT ck_movement_type CHECK (movement_type IN ('101','201','261','311','601','701','702'))
);

CREATE TABLE material_movement_item (
    id                      BIGSERIAL PRIMARY KEY,
    document_id             BIGINT NOT NULL REFERENCES material_document(id) ON DELETE CASCADE,
    line_number             INTEGER NOT NULL,
    material_id             BIGINT NOT NULL REFERENCES material(id),
    batch_id                BIGINT REFERENCES material_batch(id),
    quantity                NUMERIC(18,3) NOT NULL,
    source_location_id      BIGINT REFERENCES storage_location(id),
    destination_location_id BIGINT REFERENCES storage_location(id),
    UNIQUE (document_id, line_number),
    CONSTRAINT ck_movement_quantity CHECK (quantity > 0),
    CONSTRAINT ck_movement_locations CHECK (
      source_location_id IS NULL OR destination_location_id IS NULL OR source_location_id <> destination_location_id
    )
);

CREATE TABLE integration_outbox (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type      VARCHAR(40) NOT NULL,
    aggregate_id        VARCHAR(60) NOT NULL,
    event_type          VARCHAR(60) NOT NULL,
    payload             JSONB NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at        TIMESTAMPTZ,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    last_error          TEXT,
    CONSTRAINT ck_outbox_status CHECK (status IN ('PENDING','PUBLISHED','FAILED')),
    CONSTRAINT ck_outbox_retry CHECK (retry_count >= 0)
);

CREATE TABLE audit_log (
    id                  BIGSERIAL PRIMARY KEY,
    actor               VARCHAR(120) NOT NULL,
    action              VARCHAR(80) NOT NULL,
    entity_type         VARCHAR(50) NOT NULL,
    entity_id           VARCHAR(60) NOT NULL,
    before_data         JSONB,
    after_data          JSONB,
    correlation_id      UUID NOT NULL DEFAULT gen_random_uuid(),
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_material_description ON material USING gin (to_tsvector('spanish', description));
CREATE INDEX idx_batch_material ON material_batch(material_id);
CREATE INDEX idx_inventory_batch ON inventory_balance(batch_id);
CREATE INDEX idx_order_status_created ON business_order(status, created_at DESC);
CREATE INDEX idx_order_item_material ON business_order_item(material_id);
CREATE INDEX idx_task_status_created ON warehouse_task(status, created_at DESC);
CREATE INDEX idx_outbox_status_occurred ON integration_outbox(status, occurred_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, occurred_at DESC);

--rollback DROP TABLE audit_log, integration_outbox, material_movement_item, material_document, warehouse_task, handling_unit, inventory_reservation, order_item_batch_allocation, business_order_item, business_order, inventory_balance, business_partner, material_batch, material, unit_of_measure, storage_location, warehouse, plant, company CASCADE;
