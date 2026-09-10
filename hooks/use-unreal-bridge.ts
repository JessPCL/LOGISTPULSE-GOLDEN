"use client"

import { useEffect, useRef, useState } from "react"
import { buildUnrealSnapshot } from "@/lib/unreal-bridge"
import type { MapEdge, MapNode, Robot } from "@/lib/pulsefleet"

export type BridgeStatus = "disconnected" | "connecting" | "connected" | "error"

interface InboundEvent {
  type: "toggle_edge" | "robot_action"
  edgeId?: string
  robotId?: string
  action?: "PAUSE" | "RESUME" | "CHARGE" | "OFFLINE" | "RECOVER"
}

interface UseUnrealBridgeOptions {
  url: string
  enabled: boolean
  state: { nodes: MapNode[]; edges: MapEdge[]; robots: Robot[] }
  onToggleEdge: (edgeId: string) => void
  onRobotAction: (robotId: string, action: "PAUSE" | "RESUME" | "CHARGE" | "OFFLINE" | "RECOVER") => void
  /** Milisegundos mínimos entre envíos de snapshot. */
  throttleMs?: number
}

/**
 * Mantiene una conexión WebSocket hacia un puente de datos (ver
 * scripts/unreal-bridge-server.mjs) al que también se conecta Unreal
 * Engine 5. Cada cambio de estado envía un snapshot plano en metros
 * (buildUnrealSnapshot) y cualquier evento entrante (bloqueo de segmento,
 * acción sobre un robot disparada desde el visor 3D/VR) se reenvía al
 * motor de simulación mediante los callbacks del hook usePulseFleet.
 */
export function useUnrealBridge({
  url, enabled, state, onToggleEdge, onRobotAction, throttleMs = 300,
}: UseUnrealBridgeOptions) {
  const [internalStatus, setInternalStatus] = useState<BridgeStatus>("disconnected")
  const socketRef = useRef<WebSocket | null>(null)
  const lastSentRef = useRef(0)
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mientras el puente está desactivado, el estado visible siempre es
  // "disconnected" sin necesidad de fijarlo dentro del efecto.
  const status: BridgeStatus = enabled ? internalStatus : "disconnected"

  useEffect(() => {
    if (!enabled) {
      socketRef.current?.close()
      socketRef.current = null
      return
    }

    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el estado visible con la apertura del WebSocket, un sistema externo
    setInternalStatus("connecting")
    const socket = new WebSocket(url)
    socketRef.current = socket

    socket.addEventListener("open", () => {
      if (!cancelled) setInternalStatus("connected")
    })
    socket.addEventListener("close", () => {
      if (!cancelled) setInternalStatus("disconnected")
    })
    socket.addEventListener("error", () => {
      if (!cancelled) setInternalStatus("error")
    })
    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(String(event.data)) as InboundEvent
        if (data.type === "toggle_edge" && data.edgeId) onToggleEdge(data.edgeId)
        if (data.type === "robot_action" && data.robotId && data.action) onRobotAction(data.robotId, data.action)
      } catch {
        // Mensaje no reconocido: se ignora en vez de romper la conexión.
      }
    })

    return () => {
      cancelled = true
      socket.close()
      socketRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled])

  useEffect(() => {
    const socket = socketRef.current
    if (!enabled || !socket || socket.readyState !== WebSocket.OPEN) return

    const send = () => {
      lastSentRef.current = Date.now()
      socket.send(JSON.stringify(buildUnrealSnapshot(state)))
    }

    const elapsed = Date.now() - lastSentRef.current
    if (elapsed >= throttleMs) {
      send()
    } else if (!pendingRef.current) {
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null
        send()
      }, throttleMs - elapsed)
    }

    return () => {
      if (pendingRef.current) {
        clearTimeout(pendingRef.current)
        pendingRef.current = null
      }
    }
  }, [state, enabled, throttleMs, status])

  return { status }
}
