# Arquitectura de PULSEFLEET

## Alcance de esta versión

PULSEFLEET 1.0 es un simulador funcional ejecutado en el navegador. El motor de
simulación, el estado de la flota y la interfaz se encuentran en una sola aplicación
modular para facilitar su uso en GitHub Codespaces.

```text
Interfaz de operación
        │
        ├── Mission Control
        ├── Fleet Overview
        ├── Mission Board
        ├── Incident Center
        ├── Map Editor (+ panel de Puente Unreal Engine 5)
        └── Scenario Simulator
        │
Motor PULSEFLEET
        ├── Robot Registry
        ├── Mission Scheduler
        ├── Route Planner (Dijkstra ponderado por distancia + congestión)
        ├── Traffic Reservation
        ├── Charging Manager
        ├── Exception Handler
        └── Unreal Bridge (snapshot JSON → WebSocket)
        │
AMR Simulator + almacenamiento local
        │
        └── (opcional) scripts/unreal-bridge-server.mjs ──▶ Unreal Engine 5
```

## Decisiones de diseño

- El mapa se representa como un grafo de nodos y segmentos.
- La planificación utiliza Dijkstra ponderado por la distancia euclidiana real
  entre nodos, más un costo de congestión proporcional a cuántos robots ya
  recorren cada segmento, evitando segmentos bloqueados.
- Las asignaciones consideran disponibilidad, batería, capacidad y distancia.
- Los segmentos se reservan por ciclo para evitar que dos robots los ocupen a la vez.
- Las cargas se identifican por pallet y SSCC.
- Los cambios se guardan en `localStorage` para mantener el laboratorio autocontenido.
- El estado de la flota puede transmitirse por WebSocket (`lib/unreal-bridge.ts`)
  a un gemelo digital en Unreal Engine 5, en metros y con heading por robot,
  sin acoplar el motor de simulación a ningún renderer específico.

## Límites de seguridad

El proyecto no implementa frenado, PLC de seguridad, control de motores, SLAM ni
percepción LiDAR. Esas funciones deben permanecer en el robot y su controlador
certificado. PULSEFLEET envía objetivos y recibe estados.

## Evolución prevista

1. Sustituir el estado local por APIs Spring Boot y PostgreSQL.
2. Incorporar MQTT para comandos y telemetría.
3. Publicar eventos de negocio en Redpanda/Kafka.
4. Añadir un adaptador VDA 5050 o Open-RMF.
5. Conectar LOGISTPULSE mediante órdenes de misión.
6. Reemplazar el AMR simulado por Gazebo/ROS 2 o una flota real.
7. ~~Puente de datos hacia un gemelo digital 3D~~ — cubierto por
   `lib/unreal-bridge.ts` + `scripts/unreal-bridge-server.mjs`; pendiente de
   validar con un proyecto real de Unreal Engine 5 (NavMesh, cámaras, VR).

La interfaz puede conservarse durante estas etapas porque depende del modelo de
misiones y telemetría, no del motor físico del robot.
