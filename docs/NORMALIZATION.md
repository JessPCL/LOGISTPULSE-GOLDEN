# Dependencias funcionales y normalización

## Dependencias principales

```text
material_code → description, base_uom_id, category, weight_kg
order_number → plant_id, status, priority, requested_at, due_at
(order_id, line_number) → material_id, quantity, source_location_id, destination_location_id
task_number → order_item_id, handling_unit_id, status
(storage_location_id, batch_id) → quantity_on_hand, quantity_reserved
batch_id → material_id, batch_number, quality_status
```

## 1FN

Cada columna contiene un valor atómico. Los artículos de una orden no se
almacenan como una lista: cada artículo es una fila de `business_order_item`.

## 2FN

En las relaciones con llave compuesta, todos los atributos dependen de la llave
completa. En `inventory_balance`, las cantidades dependen conjuntamente de la
ubicación y el lote.

## 3FN

No se almacena `material_id` en `inventory_balance`, porque:

```text
batch_id → material_id
```

Guardar ambos produciría una dependencia transitiva y permitiría inconsistencias.
El material se obtiene mediante:

```text
inventory_balance → material_batch → material
```

La solicitud de material y la selección del lote también se separan:

```text
business_order_item
    → order_item_batch_allocation
    → material_batch
```

