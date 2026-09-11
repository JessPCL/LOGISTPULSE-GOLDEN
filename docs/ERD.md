# Diagrama entidad-relación

```mermaid
erDiagram
    COMPANY ||--o{ PLANT : posee
    PLANT ||--o{ WAREHOUSE : contiene
    WAREHOUSE ||--o{ STORAGE_LOCATION : organiza
    UNIT_OF_MEASURE ||--o{ MATERIAL : mide
    MATERIAL ||--o{ MATERIAL_BATCH : produce
    STORAGE_LOCATION ||--o{ INVENTORY_BALANCE : mantiene
    MATERIAL_BATCH ||--o{ INVENTORY_BALANCE : identifica
    PLANT ||--o{ BUSINESS_ORDER : recibe
    BUSINESS_ORDER ||--|{ BUSINESS_ORDER_ITEM : contiene
    MATERIAL ||--o{ BUSINESS_ORDER_ITEM : solicita
    BUSINESS_ORDER_ITEM ||--o{ ORDER_ITEM_BATCH_ALLOCATION : asigna
    MATERIAL_BATCH ||--o{ ORDER_ITEM_BATCH_ALLOCATION : satisface
    ORDER_ITEM_BATCH_ALLOCATION ||--o| INVENTORY_RESERVATION : reserva
    BUSINESS_ORDER_ITEM ||--o{ WAREHOUSE_TASK : genera
    HANDLING_UNIT ||--o{ WAREHOUSE_TASK : transporta
    BUSINESS_ORDER ||--o{ MATERIAL_DOCUMENT : origina
    MATERIAL_DOCUMENT ||--|{ MATERIAL_MOVEMENT_ITEM : registra
```

## Llaves

- Las PK internas son `BIGSERIAL` y no contienen significado empresarial.
- Los códigos como `material_code`, `order_number` y `task_number` son llaves
  candidatas protegidas con `UNIQUE`.
- `inventory_balance` utiliza PK compuesta `(storage_location_id, batch_id)`.
- `business_order_item` utiliza `UNIQUE(order_id, line_number)`.
- Las referencias se realizan siempre mediante FK.

