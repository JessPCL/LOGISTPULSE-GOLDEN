# Arquitectura ERP-PULSE V1

## Contexto

ERP-PULSE es la capa empresarial. LOGISTPULSE orquesta el trabajo, PULSEFLEET
asigna el recurso y PULSEDRIVE/Jetson ejecuta el movimiento físico.

```text
ERP-PULSE → LOGISTPULSE → PULSEFLEET → PULSEDRIVE → vehículo
     ↑                                                  │
     └──────── confirmación 311 y auditoría ────────────┘
```

## Monolito modular

```text
Interfaz web
    ↓ HTTP/JSON
API Express
    ├── Dashboard
    ├── Materiales
    ├── Inventario
    ├── Órdenes
    ├── Movimientos
    └── Integración
         ↓
Servicios de dominio
    ├── Máquina de estados
    ├── Reserva FEFO
    ├── Generación SSCC
    ├── Movimiento 311
    ├── Transactional Outbox
    └── Auditoría
         ↓
PostgreSQL + Liquibase
```

El frontend nunca modifica inventario directamente. Cada acción pasa por el
servicio de órdenes y una transacción PostgreSQL.

## Consistencia

La operación `reserve` bloquea los saldos seleccionados con `FOR UPDATE`. La
reserva, la asignación de lote, el cambio de estado y la auditoría se confirman
juntos. Ante cualquier error se ejecuta `ROLLBACK`.

La liberación inserta `TransportRequested` en `integration_outbox` dentro de la
misma transacción que crea `warehouse_task`. Así no puede existir una tarea sin
su evento ni un evento sin su tarea.

## Fronteras futuras

- LOGISTPULSE consumirá `TransportRequested`.
- PULSEFLEET recibirá la tarea logística, no la orden empresarial completa.
- ERP-PULSE recibirá `MissionCompleted` mediante un adaptador y ejecutará la
  confirmación `311` de forma idempotente.
- La Jetson nunca tendrá acceso directo a PostgreSQL.

