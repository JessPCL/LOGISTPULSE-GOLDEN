# Contrato de integración

## TransportRequested

Se crea al liberar una orden reservada:

```json
{
  "eventVersion": 1,
  "orderNumber": "ORD-000001",
  "orderItem": 10,
  "warehouseTask": "WT-000001",
  "materialCode": "MAT-000001",
  "quantity": 50,
  "handlingUnit": "PALLET-000001",
  "sscc": "178612340000000019",
  "sourceLocation": "RACK-A01",
  "destinationLocation": "STAGING-01",
  "priority": "HIGH"
}
```

LOGISTPULSE debe usar el UUID del evento Outbox como clave de idempotencia. La
confirmación del consumidor no cambia inventario; el inventario cambia únicamente
cuando ERP-PULSE contabiliza el movimiento `311`.
