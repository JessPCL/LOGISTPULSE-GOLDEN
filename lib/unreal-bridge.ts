import { edgeDistance, nodeById, type MapEdge, type MapNode, type Robot } from "./pulsefleet.ts"

/**
 * Escala de conversión de unidades del plano 2D (SVG, px) a metros del
 * mundo 3D en Unreal. Ajusta este valor según el tamaño real de tu planta:
 * si el pasillo más largo del mapa mide 60 px y en la realidad son 12 m,
 * METERS_PER_UNIT sería 12 / 60 = 0.2.
 */
export const METERS_PER_UNIT = 0.05

export interface UnrealNode {
  id: string
  label: string
  type: MapNode["type"]
  /** Coordenadas en metros, listas para World Location en Unreal (Z=0, piso). */
  x: number
  y: number
  z: number
}

export interface UnrealEdge {
  id: string
  from: string
  to: string
  blocked: boolean
  oneWay: boolean
  distanceMeters: number
}

export interface UnrealRobot {
  id: string
  model: string
  status: Robot["status"]
  x: number
  y: number
  z: number
  /** Ángulo en grados sobre el eje Z (yaw), 0 = mirando hacia +X. */
  headingDeg: number
  battery: number
  missionId?: string
  payload?: string
  /** Nodos restantes de la ruta actual, en orden. */
  routeRemaining: string[]
}

export interface UnrealSnapshot {
  schema: "pulsefleet.unreal.v1"
  timestamp: string
  mapVersion: string
  metersPerUnit: number
  nodes: UnrealNode[]
  edges: UnrealEdge[]
  robots: UnrealRobot[]
}

function headingOf(nodes: MapNode[], robot: Robot): number {
  const nextId = robot.route[robot.routeIndex + 1]
  const currentId = robot.route[robot.routeIndex]
  const from = currentId ? nodeById(nodes, currentId) : undefined
  const to = nextId ? nodeById(nodes, nextId) : undefined
  if (!from || !to) return 0
  const angleRad = Math.atan2(to.y - from.y, to.x - from.x)
  return Math.round(((angleRad * 180) / Math.PI + 360) % 360)
}

/**
 * Convierte el estado en memoria del simulador (2D, unidades del SVG) a un
 * snapshot plano en metros, listo para enviarse por el puente de datos
 * (WebSocket/REST) a un proyecto de Unreal Engine 5. Es una función pura:
 * no depende de React ni de red, para poder probarla o reusarla en el
 * servidor del puente.
 */
export function buildUnrealSnapshot(state: {
  nodes: MapNode[]
  edges: MapEdge[]
  robots: Robot[]
}, mapVersion = "PLANTA-V1.3"): UnrealSnapshot {
  const scale = METERS_PER_UNIT
  return {
    schema: "pulsefleet.unreal.v1",
    timestamp: new Date().toISOString(),
    mapVersion,
    metersPerUnit: scale,
    nodes: state.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      x: Number((node.x * scale).toFixed(3)),
      y: Number((node.y * scale).toFixed(3)),
      z: 0,
    })),
    edges: state.edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      blocked: edge.blocked,
      oneWay: Boolean(edge.oneWay),
      distanceMeters: Number((edgeDistance(state.nodes, edge) * scale).toFixed(3)),
    })),
    robots: state.robots.map((robot) => ({
      id: robot.id,
      model: robot.model,
      status: robot.status,
      x: Number((robot.x * scale).toFixed(3)),
      y: Number((robot.y * scale).toFixed(3)),
      z: 0,
      headingDeg: headingOf(state.nodes, robot),
      battery: Math.round(robot.battery),
      missionId: robot.missionId,
      payload: robot.payload,
      routeRemaining: robot.route.slice(robot.routeIndex),
    })),
  }
}
