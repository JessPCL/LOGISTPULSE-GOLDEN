"use client"

import type { MapEdge, MapNode, Robot } from "@/lib/pulsefleet"
import { nodeById, statusLabel } from "@/lib/pulsefleet"
import { cn } from "@/lib/utils"

interface FactoryMapProps {
  nodes: MapNode[]
  edges: MapEdge[]
  robots: Robot[]
  editable?: boolean
  selectedRobotId?: string
  onRobotSelect?: (id: string) => void
  onEdgeSelect?: (id: string) => void
}

const nodeColor: Record<MapNode["type"], string> = {
  RACK: "#475569",
  STAGING: "#0e7490",
  DOCK: "#2563eb",
  CHARGER: "#7c3aed",
  JUNCTION: "#94a3b8",
}

const robotColor: Record<Robot["status"], string> = {
  AVAILABLE: "#16a34a",
  ASSIGNED: "#0284c7",
  MOVING_TO_PICKUP: "#0284c7",
  LOADING: "#d97706",
  MOVING_TO_DESTINATION: "#2563eb",
  UNLOADING: "#d97706",
  CHARGING: "#7c3aed",
  BLOCKED: "#ea580c",
  OFFLINE: "#64748b",
  PAUSED: "#ca8a04",
}

export function FactoryMap({
  nodes,
  edges,
  robots,
  editable = false,
  selectedRobotId,
  onRobotSelect,
  onEdgeSelect,
}: FactoryMapProps) {
  const activeSegments = new Set(
    robots.flatMap((robot) => robot.route.slice(0, -1).map((node, index) =>
      [node, robot.route[index + 1]].sort().join("::"),
    )),
  )
  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-[#f7f9fc] shadow-inner">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(#dbe3ee_1px,transparent_1px),linear-gradient(90deg,#dbe3ee_1px,transparent_1px)] [background-size:28px_28px]" />
      <svg
        viewBox="0 0 1020 680"
        className="relative h-full min-h-[420px] w-full"
        role="img"
        aria-label="Mapa operativo de la planta con rutas y robots"
      >
        <defs>
          <filter id="robot-shadow" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodOpacity="0.24" />
          </filter>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>

        <text x="36" y="46" fill="#64748b" fontSize="14" fontWeight="700" letterSpacing="2">PLANTA · OPERACIÓN EN VIVO</text>

        {edges.map((edge) => {
          const from = nodeById(nodes, edge.from)
          const to = nodeById(nodes, edge.to)
          if (!from || !to) return null
          const active = activeSegments.has([edge.from, edge.to].sort().join("::"))
          return (
            <g key={edge.id} onClick={() => editable && onEdgeSelect?.(edge.id)} className={editable ? "cursor-pointer" : undefined}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="transparent"
                strokeWidth="22"
              />
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={edge.blocked ? "#ef4444" : active ? "#06b6d4" : "#aebdce"}
                strokeWidth={edge.blocked || active ? 6 : 4}
                strokeDasharray={edge.blocked ? "8 7" : undefined}
                markerEnd={edge.oneWay ? "url(#arrow)" : undefined}
                className="transition-all"
              />
              {edge.blocked && (
                <g transform={`translate(${(from.x + to.x) / 2}, ${(from.y + to.y) / 2})`}>
                  <circle r="14" fill="#fff" stroke="#ef4444" strokeWidth="3" />
                  <path d="M-6-6 L6 6 M6-6 L-6 6" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                </g>
              )}
            </g>
          )
        })}

        {nodes.map((node) => {
          const wide = node.type !== "JUNCTION"
          return (
            <g key={node.id} transform={`translate(${node.x},${node.y})`}>
              {node.type === "JUNCTION" ? (
                <circle r="9" fill={nodeColor[node.type]} stroke="#fff" strokeWidth="4" />
              ) : (
                <>
                  <rect x={wide ? -47 : -12} y="-20" width={wide ? 94 : 24} height="40" rx="9" fill="#fff" stroke={nodeColor[node.type]} strokeWidth="2.5" />
                  <rect x={wide ? -47 : -12} y="-20" width="7" height="40" rx="5" fill={nodeColor[node.type]} />
                  <text textAnchor="middle" y="5" fill="#26364b" fontSize="12" fontWeight="700">{node.label}</text>
                </>
              )}
              {node.type === "JUNCTION" && <text textAnchor="middle" y="28" fill="#64748b" fontSize="10" fontWeight="700">{node.label}</text>}
            </g>
          )
        })}

        {robots.map((robot) => {
          const selected = selectedRobotId === robot.id
          return (
            <g
              key={robot.id}
              transform={`translate(${robot.x},${robot.y})`}
              onClick={() => onRobotSelect?.(robot.id)}
              className={cn("cursor-pointer transition-all", robot.status === "OFFLINE" && "opacity-60")}
              filter="url(#robot-shadow)"
              role="button"
              aria-label={`${robot.id}: ${statusLabel[robot.status]}`}
            >
              {selected && <circle r="34" fill="none" stroke={robotColor[robot.status]} strokeWidth="3" strokeDasharray="5 4" />}
              <rect x="-27" y="-22" width="54" height="44" rx="13" fill="#fff" stroke={robotColor[robot.status]} strokeWidth="4" />
              <rect x="-17" y="-12" width="34" height="15" rx="4" fill={robotColor[robot.status]} opacity="0.16" />
              <circle cx="-16" cy="23" r="5" fill="#253449" />
              <circle cx="16" cy="23" r="5" fill="#253449" />
              <text textAnchor="middle" y="-3" fill="#172033" fontSize="10" fontWeight="800">{robot.id.replace("AMR-", "R")}</text>
              <text textAnchor="middle" y="52" fill="#334155" fontSize="11" fontWeight="800">{robot.id}</text>
              <text textAnchor="middle" y="66" fill="#64748b" fontSize="9">{Math.round(robot.battery)}% · {statusLabel[robot.status]}</text>
            </g>
          )
        })}
      </svg>

      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur">
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-green-600" />Disponible</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-blue-600" />En misión</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-orange-600" />Atención</span>
        <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-violet-600" />Carga</span>
      </div>
    </div>
  )
}
