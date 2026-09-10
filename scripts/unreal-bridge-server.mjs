// Puente WebSocket entre PulseFleet (navegador) y Unreal Engine 5.
//
// Uso:
//   npm run bridge:server
//
// Cualquier mensaje recibido de un cliente (el snapshot JSON del navegador,
// o un evento JSON enviado desde Blueprints en Unreal) se retransmite a
// todos los demás clientes conectados. No interpreta el contenido: solo
// actúa como relay, así que tanto el navegador como Unreal deben hablar el
// mismo esquema (ver lib/unreal-bridge.ts para el snapshot saliente y el
// tipo InboundEvent en hooks/use-unreal-bridge.ts para los eventos que
// Unreal puede enviar de vuelta).

import { WebSocketServer } from "ws"

const port = Number(process.env.BRIDGE_PORT ?? 8787)
const wss = new WebSocketServer({ port })

console.log(`[unreal-bridge] escuchando en ws://localhost:${port}`)
console.log("[unreal-bridge] en Codespaces, expón este puerto como público para que Unreal pueda conectarse")

wss.on("connection", (socket, request) => {
  const clientId = `${request.socket.remoteAddress ?? "desconocido"}:${Date.now()}`
  console.log(`[unreal-bridge] cliente conectado (${clientId}), total=${wss.clients.size}`)

  socket.on("message", (data) => {
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === client.OPEN) {
        client.send(data.toString())
      }
    }
  })

  socket.on("close", () => {
    console.log(`[unreal-bridge] cliente desconectado (${clientId}), total=${wss.clients.size - 1}`)
  })

  socket.on("error", (error) => {
    console.error(`[unreal-bridge] error en cliente ${clientId}:`, error.message)
  })
})
