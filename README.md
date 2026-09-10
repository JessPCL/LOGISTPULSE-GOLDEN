# ERP-PULSE V1

ERP empresarial mínimo para órdenes de transferencia, inventario por lote,
reservas, tareas logísticas y movimientos de material. Es la capa tipo SAP del
ecosistema PULSE.

## Flujo demostrable

```text
ORD-000001
  → validar datos
  → reservar 50 unidades
  → seleccionar lote FEFO
  → crear WT-000001
  → publicar TransportRequested
  → iniciar ejecución
  → confirmar movimiento 311
  → actualizar inventario
  → registrar auditoría
```

## Componentes

- API Node.js 22 + Express + TypeScript.
- PostgreSQL 16 como fuente de verdad.
- Liquibase para Database-as-Code.
- Interfaz responsive de seis pantallas.
- Transactional Outbox para LOGISTPULSE.
- 10.000 materiales y más de 20.000 registros de prueba.
- Docker Compose y configuración de GitHub Codespaces.

## Iniciar en Codespaces

1. Cargue el contenido del ZIP en la raíz de un repositorio GitHub.
2. Abra **Code → Codespaces → Create codespace on main**.
3. Espere a que finalice la preparación.
4. Ejecute:

```bash
docker compose up --build
```

5. Abra el puerto `8000` cuando Codespaces lo anuncie.

Liquibase crea el modelo y carga automáticamente los datos antes de iniciar la
aplicación.

## Comandos útiles

```bash
# Levantar la plataforma
docker compose up --build

# Ver servicios
docker compose ps

# Ejecutar smoke test
bash scripts/smoke.sh

# Detener sin borrar datos
docker compose stop

# Detener y eliminar contenedores, conservando el código
docker compose down

# Reinicio completo de la base de demostración
docker compose down -v
docker compose up --build
```

El último comando elimina el volumen de PostgreSQL y debe utilizarse solo para
reiniciar el laboratorio.

## Desarrollo sin contenedor de aplicación

Mantenga PostgreSQL y Liquibase en Docker:

```bash
docker compose up database liquibase
npm run dev
```

La aplicación usa por defecto:

```text
postgresql://erp_pulse:erp_pulse@localhost:5432/erp_pulse
```

## API principal

```text
GET  /api/health
GET  /api/dashboard
GET  /api/materials
GET  /api/inventory
GET  /api/orders
POST /api/orders
POST /api/orders/{number}/validate
POST /api/orders/{number}/reserve
POST /api/orders/{number}/release
POST /api/orders/{number}/start
POST /api/orders/{number}/confirm
POST /api/orders/{number}/cancel
GET  /api/movements
GET  /api/integration/events
GET  /api/integration/audit
```

## Alcance y seguridad

ERP-PULSE V1 es un laboratorio empresarial ejecutable. Implementa integridad,
transacciones, validaciones, auditoría y cabeceras HTTP seguras, pero no incluye
todavía un proveedor OIDC ni RBAC productivo. No debe publicarse en Internet con
las credenciales de demostración. La siguiente versión incorporará identidad,
roles y entrega efectiva del Outbox mediante Kafka/Redpanda.

