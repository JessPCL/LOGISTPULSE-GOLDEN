export type ScreenId =
  | "control"
  | "fleet"
  | "missions"
  | "incidents"
  | "map"
  | "scenarios"

export type RobotStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "MOVING_TO_PICKUP"
  | "LOADING"
  | "MOVING_TO_DESTINATION"
  | "UNLOADING"
  | "CHARGING"
  | "BLOCKED"
  | "OFFLINE"
  | "PAUSED"

export type MissionStatus =
  | "PENDING"
  | "ASSIGNED"
  | "PICKUP"
  | "IN_TRANSIT"
  | "DELIVERY"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"

export type Priority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW"

export interface MapNode {
  id: string
  label: string
  type: "RACK" | "STAGING" | "DOCK" | "CHARGER" | "JUNCTION"
  x: number
  y: number
}

export interface MapEdge {
  id: string
  from: string
  to: string
  blocked: boolean
  oneWay?: boolean
}

export interface Robot {
  id: string
  model: string
  status: RobotStatus
  battery: number
  capacityKg: number
  nodeId: string
  x: number
  y: number
  speed: number
  missionId?: string
  payload?: string
  route: string[]
  routeIndex: number
  segmentProgress: number
  phaseTicks: number
  distanceKm: number
  completedToday: number
  lastSeen: string
  targetMode?: "CHARGE"
}

export interface Mission {
  id: string
  pallet: string
  sscc: string
  origin: string
  destination: string
  priority: Priority
  status: MissionStatus
  robotId?: string
  progress: number
  createdAt: string
  dueAt: string
  weightKg: number
  product: string
}

export interface Incident {
  id: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  type: string
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED"
  message: string
  zone: string
  robotId?: string
  missionId?: string
  createdAt: string
}

export const nodesSeed: MapNode[] = [
  { id: "RACK-A01", label: "Rack A-01", type: "RACK", x: 90, y: 110 },
  { id: "RACK-A02", label: "Rack A-02", type: "RACK", x: 90, y: 260 },
  { id: "RACK-B01", label: "Rack B-01", type: "RACK", x: 90, y: 430 },
  { id: "RACK-B02", label: "Rack B-02", type: "RACK", x: 90, y: 565 },
  { id: "J-01", label: "Cruce 01", type: "JUNCTION", x: 310, y: 185 },
  { id: "J-02", label: "Cruce 02", type: "JUNCTION", x: 310, y: 490 },
  { id: "J-03", label: "Cruce Central", type: "JUNCTION", x: 540, y: 335 },
  { id: "STAGING-01", label: "Staging 01", type: "STAGING", x: 760, y: 160 },
  { id: "STAGING-02", label: "Staging 02", type: "STAGING", x: 760, y: 315 },
  { id: "DOCK-01", label: "Muelle 01", type: "DOCK", x: 930, y: 235 },
  { id: "CHARGER-01", label: "Cargador", type: "CHARGER", x: 600, y: 565 },
]

export const edgesSeed: MapEdge[] = [
  { id: "E-01", from: "RACK-A01", to: "J-01", blocked: false },
  { id: "E-02", from: "RACK-A02", to: "J-01", blocked: false },
  { id: "E-03", from: "RACK-B01", to: "J-02", blocked: false },
  { id: "E-04", from: "RACK-B02", to: "J-02", blocked: false },
  { id: "E-05", from: "J-01", to: "J-03", blocked: false },
  { id: "E-06", from: "J-02", to: "J-03", blocked: false },
  { id: "E-07", from: "J-01", to: "J-02", blocked: false },
  { id: "E-08", from: "J-03", to: "STAGING-01", blocked: false },
  { id: "E-09", from: "J-03", to: "STAGING-02", blocked: false },
  { id: "E-10", from: "STAGING-01", to: "DOCK-01", blocked: false },
  { id: "E-11", from: "STAGING-02", to: "DOCK-01", blocked: false },
  { id: "E-12", from: "J-02", to: "CHARGER-01", blocked: false },
  { id: "E-13", from: "J-03", to: "CHARGER-01", blocked: false },
]

export const robotsSeed: Robot[] = [
  {
    id: "AMR-01", model: "PF-600", status: "AVAILABLE", battery: 92,
    capacityKg: 600, nodeId: "J-01", x: 310, y: 185, speed: 1.2,
    route: [], routeIndex: 0, segmentProgress: 0, phaseTicks: 0,
    distanceKm: 18.4, completedToday: 24, lastSeen: "ahora",
  },
  {
    id: "AMR-02", model: "PF-1200", status: "AVAILABLE", battery: 76,
    capacityKg: 1200, nodeId: "STAGING-02", x: 760, y: 315, speed: 1.0,
    route: [], routeIndex: 0, segmentProgress: 0, phaseTicks: 0,
    distanceKm: 21.7, completedToday: 31, lastSeen: "ahora",
  },
  {
    id: "AMR-03", model: "PF-600", status: "CHARGING", battery: 38,
    capacityKg: 600, nodeId: "CHARGER-01", x: 600, y: 565, speed: 1.2,
    route: [], routeIndex: 0, segmentProgress: 0, phaseTicks: 0,
    distanceKm: 13.1, completedToday: 18, lastSeen: "ahora",
  },
]

export const missionsSeed: Mission[] = [
  {
    id: "MSN-2301", pallet: "PALLET-889", sscc: "178612340000008895",
    origin: "RACK-A01", destination: "STAGING-01", priority: "HIGH",
    status: "PENDING", progress: 0, createdAt: "09:42", dueAt: "10:15",
    weightKg: 480, product: "Cajas de producto terminado",
  },
  {
    id: "MSN-2298", pallet: "PALLET-875", sscc: "178612340000008758",
    origin: "RACK-B02", destination: "DOCK-01", priority: "NORMAL",
    status: "COMPLETED", robotId: "AMR-02", progress: 100,
    createdAt: "08:31", dueAt: "09:30", weightKg: 720,
    product: "Carga mixta consolidada",
  },
  {
    id: "MSN-2300", pallet: "PALLET-884", sscc: "178612340000008840",
    origin: "RACK-A02", destination: "STAGING-02", priority: "NORMAL",
    status: "PENDING", progress: 0, createdAt: "09:28", dueAt: "10:45",
    weightKg: 350, product: "Materia prima embalada",
  },
]

export const incidentsSeed: Incident[] = [
  {
    id: "INC-041", severity: "MEDIUM", type: "CONGESTION",
    status: "ACKNOWLEDGED", message: "Demora temporal en Cruce Central",
    zone: "J-03", robotId: "AMR-02", createdAt: "09:18",
  },
  {
    id: "INC-039", severity: "LOW", type: "BATTERY",
    status: "RESOLVED", message: "AMR-03 enviado a carga oportunista",
    zone: "CHARGER-01", robotId: "AMR-03", createdAt: "08:54",
  },
]

export const nodeById = (nodes: MapNode[], id: string) =>
  nodes.find((node) => node.id === id)

export function edgeDistance(nodes: MapNode[], edge: MapEdge): number {
  const from = nodeById(nodes, edge.from)
  const to = nodeById(nodes, edge.to)
  if (!from || !to) return Infinity
  return Math.hypot(to.x - from.x, to.y - from.y)
}

/**
 * Camino más corto ponderado (Dijkstra) por distancia euclidiana real entre
 * nodos, con un costo adicional de congestión proporcional al número de
 * robots que ya están recorriendo cada segmento. Esto permite que el
 * planificador prefiera rutas más largas pero libres en vez de siempre el
 * camino con menos saltos.
 *
 * `robots` es opcional para no romper llamadas existentes que solo quieren
 * el camino más corto físico (por ejemplo, ir a un cargador).
 */
export function shortestPath(
  nodes: MapNode[],
  edges: MapEdge[],
  from: string,
  to: string,
  robots: Robot[] = [],
  congestionWeight = 40,
): string[] {
  if (from === to) return [from]

  const congestion = new Map<string, number>()
  robots.forEach((robot) => {
    for (let index = 0; index < robot.route.length - 1; index += 1) {
      const key = [robot.route[index], robot.route[index + 1]].sort().join("::")
      congestion.set(key, (congestion.get(key) ?? 0) + 1)
    }
  })

  interface AdjEntry { to: string; cost: number }
  const adjacency = new Map<string, AdjEntry[]>()
  nodes.forEach((node) => adjacency.set(node.id, []))
  edges.filter((edge) => !edge.blocked).forEach((edge) => {
    const base = edgeDistance(nodes, edge)
    const key = [edge.from, edge.to].sort().join("::")
    const cost = base + (congestion.get(key) ?? 0) * congestionWeight
    adjacency.get(edge.from)?.push({ to: edge.to, cost })
    if (!edge.oneWay) adjacency.get(edge.to)?.push({ to: edge.from, cost })
  })

  const dist = new Map<string, number>(nodes.map((node) => [node.id, Infinity]))
  const prev = new Map<string, string>()
  const visited = new Set<string>()
  dist.set(from, 0)

  while (visited.size < nodes.length) {
    let current: string | null = null
    let currentDist = Infinity
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < currentDist) {
        current = id
        currentDist = d
      }
    }
    if (current === null) break
    if (current === to) break
    visited.add(current)
    for (const { to: next, cost } of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue
      const candidate = currentDist + cost
      if (candidate < (dist.get(next) ?? Infinity)) {
        dist.set(next, candidate)
        prev.set(next, current)
      }
    }
  }

  if (!prev.has(to) && from !== to) return []
  const path: string[] = [to]
  let cursor = to
  while (cursor !== from) {
    const previous = prev.get(cursor)
    if (!previous) return []
    path.unshift(previous)
    cursor = previous
  }
  return path
}

export const statusLabel: Record<RobotStatus, string> = {
  AVAILABLE: "Disponible", ASSIGNED: "Asignado", MOVING_TO_PICKUP: "Hacia origen",
  LOADING: "Cargando", MOVING_TO_DESTINATION: "En tránsito", UNLOADING: "Descargando",
  CHARGING: "Recargando", BLOCKED: "Bloqueado", OFFLINE: "Desconectado", PAUSED: "Pausado",
}

export const missionStatusLabel: Record<MissionStatus, string> = {
  PENDING: "Pendiente", ASSIGNED: "Asignada", PICKUP: "Recogida",
  IN_TRANSIT: "En tránsito", DELIVERY: "Entrega", COMPLETED: "Completada",
  FAILED: "Fallida", CANCELLED: "Cancelada",
}
