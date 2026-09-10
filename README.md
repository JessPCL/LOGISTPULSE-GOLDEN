# PULSEFLEET

Simulador interactivo de gestión de flotas AMR para el ecosistema LOGISTPULSE.

## Funcionalidades

- Mission Control con mapa 2D y telemetría en tiempo real.
- Fleet Overview con estado, batería, capacidad y acciones por robot.
- Mission Board con asignación, ejecución y trazabilidad SSCC.
- Incident Center con reconocimiento y resolución de excepciones.
- Map Editor para añadir nodos y bloquear segmentos.
- Ruteo por Dijkstra ponderado por distancia real y congestión de la flota (ver "Navegación" abajo).
- Puente WebSocket hacia Unreal Engine 5 para un gemelo digital 3D (ver "Puente con Unreal Engine 5" abajo).
- Scenario Simulator con fallos, prioridad, congestión y velocidad variable.
- Persistencia local automática en el navegador.

## Navegación

El planificador de rutas (`lib/pulsefleet.ts`, función `shortestPath`) usa Dijkstra
sobre la distancia euclidiana real entre nodos, no un simple conteo de saltos.
Además suma un costo de congestión por cada robot que ya está recorriendo un
segmento, así que la flota prefiere una ruta más larga pero libre en vez de
amontonarse en el camino "más corto" cuando ya está ocupado. Los tests en
`tests/navigation-and-bridge.test.mjs` cubren ambos comportamientos.

## Puente con Unreal Engine 5

`lib/unreal-bridge.ts` serializa el estado (nodos, arcos, robots) a un
snapshot plano en metros con el schema `pulsefleet.unreal.v1`, incluyendo el
heading de cada robot en grados. Para transmitirlo en vivo:

1. Ejecuta `npm run bridge:server` (levanta un relay WebSocket en
   `ws://localhost:8787`; en Codespaces, expón ese puerto como público).
2. En la app, ve a **Map Editor → Puente Unreal Engine 5**, activa el switch
   y confirma que el estado pase a "Conectado".
3. En tu proyecto de Unreal, conecta un cliente WebSocket (Blueprint o C++) a
   la misma URL. Cada mensaje entrante es un snapshot JSON completo; puedes
   usarlo para actualizar Actors sobre un NavMesh construido a partir de los
   mismos nodos.
4. Unreal puede enviar eventos de vuelta con `{"type":"toggle_edge","edgeId":"E-08"}`
   o `{"type":"robot_action","robotId":"AMR-01","action":"PAUSE"}`; el hook
   `useUnrealBridge` los aplica sobre el motor de simulación.

También puedes usar el botón "Copiar snapshot JSON" del mismo panel para una
prueba puntual sin levantar el servidor.

## Ejecutar en GitHub Codespaces

1. Crear un repositorio nuevo y cargar el contenido de este proyecto.
2. Abrir **Code → Codespaces → Create codespace on main**.
3. Esperar que finalice la instalación automática.
4. Ejecutar:

```bash
npm run dev
```

5. Abrir el puerto `5173` cuando Codespaces lo anuncie.

## Ejecutar localmente

Requiere Node.js 22 o superior.

```bash
npm install
npm run dev
```

## Construir

```bash
npm run build
```

## Alcance

Esta versión implementa la lógica de simulación en el navegador. No controla motores,
sensores ni funciones certificadas de seguridad. La integración futura con ROS 2,
Open-RMF o un Fleet Manager comercial debe realizarse mediante adaptadores.

## Restablecer los datos

Use **Scenario Simulator → Reiniciar**. Esto restaura robots, mapa, misiones e
incidentes iniciales.
