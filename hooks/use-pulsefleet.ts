"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  edgesSeed,
  incidentsSeed,
  missionsSeed,
  nodeById,
  nodesSeed,
  robotsSeed,
  shortestPath,
  type Incident,
  type MapEdge,
  type MapNode,
  type Mission,
  type Priority,
  type Robot,
  type RobotStatus,
} from "@/lib/pulsefleet"

interface SimulationState {
  robots: Robot[]
  missions: Mission[]
  incidents: Incident[]
  nodes: MapNode[]
  edges: MapEdge[]
}

const initialState = (): SimulationState => ({
  robots: structuredClone(robotsSeed),
  missions: structuredClone(missionsSeed),
  incidents: structuredClone(incidentsSeed),
  nodes: structuredClone(nodesSeed),
  edges: structuredClone(edgesSeed),
})

const clock = () => new Date().toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })

function assignment(state: SimulationState, missionId: string): SimulationState {
  const mission = state.missions.find((item) => item.id === missionId)
  if (!mission || mission.status !== "PENDING") return state

  const candidates = state.robots
    .filter((robot) => robot.status === "AVAILABLE" && robot.battery >= 25 && robot.capacityKg >= mission.weightKg)
    .map((robot) => {
      const toPickup = shortestPath(state.nodes, state.edges, robot.nodeId, mission.origin, state.robots)
      const toDelivery = shortestPath(state.nodes, state.edges, mission.origin, mission.destination, state.robots)
      return { robot, toPickup, score: toPickup.length + toDelivery.length - robot.battery / 50 }
    })
    .filter((item) => item.toPickup.length > 0)
    .sort((a, b) => a.score - b.score)

  if (!candidates.length) return state
  const selected = candidates[0]
  return {
    ...state,
    missions: state.missions.map((item) =>
      item.id === missionId
        ? { ...item, status: "ASSIGNED", robotId: selected.robot.id, progress: 5 }
        : item,
    ),
    robots: state.robots.map((robot) =>
      robot.id === selected.robot.id
        ? {
            ...robot,
            status: "MOVING_TO_PICKUP",
            missionId,
            route: selected.toPickup,
            routeIndex: 0,
            segmentProgress: 0,
            phaseTicks: 0,
          }
        : robot,
    ),
  }
}

export function usePulseFleet() {
  const [state, setState] = useState<SimulationState>(initialState)
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState(1)
  const hydrated = useRef(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pulsefleet-v1")
      if (saved) setState(JSON.parse(saved) as SimulationState)
    } catch {
      localStorage.removeItem("pulsefleet-v1")
    }
    hydrated.current = true
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    localStorage.setItem("pulsefleet-v1", JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setState((current) => {
        let missions = [...current.missions]
        let incidents = [...current.incidents]

        const updateMission = (id: string | undefined, patch: Partial<Mission>) => {
          if (!id) return
          missions = missions.map((mission) => mission.id === id ? { ...mission, ...patch } : mission)
        }

        const claimedSegments = new Set<string>()
        const robots = current.robots.map((robot) => {
          if (robot.status === "AVAILABLE" && robot.battery < 20) {
            const route = shortestPath(current.nodes, current.edges, robot.nodeId, "CHARGER-01", current.robots)
            if (route.length <= 1) return { ...robot, status: "CHARGING" as RobotStatus }
            return {
              ...robot, status: "MOVING_TO_DESTINATION" as RobotStatus, targetMode: "CHARGE" as const,
              route, routeIndex: 0, segmentProgress: 0,
            }
          }
          if (["OFFLINE", "PAUSED", "BLOCKED", "AVAILABLE"].includes(robot.status)) return robot

          if (robot.status === "CHARGING") {
            const battery = Math.min(100, robot.battery + 2.5)
            return { ...robot, battery, status: battery >= 95 ? "AVAILABLE" as RobotStatus : robot.status }
          }

          if (robot.status === "LOADING") {
            if (robot.phaseTicks > 0) return { ...robot, phaseTicks: robot.phaseTicks - 1 }
            const mission = missions.find((item) => item.id === robot.missionId)
            if (!mission) return { ...robot, status: "AVAILABLE" as RobotStatus, missionId: undefined }
            const route = shortestPath(current.nodes, current.edges, mission.origin, mission.destination, current.robots)
            if (!route.length) {
              updateMission(robot.missionId, { status: "FAILED" })
              incidents.unshift({
                id: `INC-${Date.now()}`, severity: "HIGH", type: "NO_ROUTE", status: "OPEN",
                message: `No existe ruta hacia ${mission.destination}`, zone: mission.origin,
                robotId: robot.id, missionId: mission.id, createdAt: clock(),
              })
              return { ...robot, status: "BLOCKED" as RobotStatus }
            }
            updateMission(robot.missionId, { status: "IN_TRANSIT", progress: 45 })
            return {
              ...robot, status: "MOVING_TO_DESTINATION" as RobotStatus, payload: mission.pallet,
              route, routeIndex: 0, segmentProgress: 0,
            }
          }

          if (robot.status === "UNLOADING") {
            if (robot.phaseTicks > 0) return { ...robot, phaseTicks: robot.phaseTicks - 1 }
            updateMission(robot.missionId, { status: "COMPLETED", progress: 100 })
            return {
              ...robot, status: "AVAILABLE" as RobotStatus, missionId: undefined, payload: undefined,
              route: [], routeIndex: 0, segmentProgress: 0,
              completedToday: robot.completedToday + 1,
            }
          }

          if (["MOVING_TO_PICKUP", "MOVING_TO_DESTINATION"].includes(robot.status)) {
            const path = robot.route
            if (!path.length || robot.routeIndex >= path.length - 1) {
              if (robot.status === "MOVING_TO_PICKUP") {
                updateMission(robot.missionId, { status: "PICKUP", progress: 35 })
                return { ...robot, status: "LOADING" as RobotStatus, phaseTicks: 2 }
              }
              if (robot.targetMode === "CHARGE") {
                return {
                  ...robot, status: "CHARGING" as RobotStatus, targetMode: undefined,
                  route: [], routeIndex: 0, segmentProgress: 0,
                }
              }
              updateMission(robot.missionId, { status: "DELIVERY", progress: 90 })
              return { ...robot, status: "UNLOADING" as RobotStatus, phaseTicks: 2 }
            }

            const fromId = path[robot.routeIndex]
            const toId = path[robot.routeIndex + 1]
            const segmentKey = [fromId, toId].sort().join("::")
            if (claimedSegments.has(segmentKey)) return robot
            claimedSegments.add(segmentKey)
            const blocked = current.edges.some(
              (edge) => edge.blocked && ((edge.from === fromId && edge.to === toId) || (!edge.oneWay && edge.from === toId && edge.to === fromId)),
            )
            if (blocked) {
              const activeMission = missions.find((mission) => mission.id === robot.missionId)
              const target = robot.targetMode === "CHARGE"
                ? "CHARGER-01"
                : robot.status === "MOVING_TO_PICKUP" ? activeMission?.origin : activeMission?.destination
              const alternate = target ? shortestPath(current.nodes, current.edges, robot.nodeId, target, current.robots) : []
              if (!incidents.some((incident) => incident.status !== "RESOLVED" && incident.robotId === robot.id && incident.type === "ROUTE_BLOCKED")) {
                incidents.unshift({
                  id: `INC-${Date.now()}-${robot.id}`, severity: "HIGH", type: "ROUTE_BLOCKED",
                  status: "OPEN", message: `Ruta bloqueada entre ${fromId} y ${toId}`,
                  zone: fromId, robotId: robot.id, missionId: robot.missionId, createdAt: clock(),
                })
              }
              if (alternate.length > 1) return { ...robot, route: alternate, routeIndex: 0, segmentProgress: 0 }
              return { ...robot, status: "BLOCKED" as RobotStatus }
            }

            const from = nodeById(current.nodes, fromId)
            const to = nodeById(current.nodes, toId)
            if (!from || !to) return robot
            let progress = robot.segmentProgress + 0.12 * speed
            let routeIndex = robot.routeIndex
            let nodeId = robot.nodeId
            let x = from.x + (to.x - from.x) * Math.min(progress, 1)
            let y = from.y + (to.y - from.y) * Math.min(progress, 1)
            if (progress >= 1) {
              progress = 0
              routeIndex += 1
              nodeId = to.id
              x = to.x
              y = to.y
            }
            const battery = Math.max(0, robot.battery - 0.12)
            const base = robot.status === "MOVING_TO_PICKUP" ? 10 : 50
            const ratio = path.length > 1 ? routeIndex / (path.length - 1) : 1
            updateMission(robot.missionId, { progress: Math.min(88, Math.round(base + ratio * 35)) })
            return {
              ...robot, routeIndex, segmentProgress: progress, nodeId, x, y, battery,
              distanceKm: robot.distanceKm + 0.008, lastSeen: "ahora",
            }
          }
          return robot
        })

        return { ...current, robots, missions, incidents }
      })
    }, 650)
    return () => window.clearInterval(timer)
  }, [running, speed])

  const assignMission = (missionId: string) => setState((current) => assignment(current, missionId))

  const assignAll = () => setState((current) =>
    current.missions.filter((mission) => mission.status === "PENDING")
      .sort((a, b) => ({ CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 }[a.priority] - { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 }[b.priority]))
      .reduce((next, mission) => assignment(next, mission.id), current),
  )

  const createMission = (input: {
    origin: string
    destination: string
    priority: Priority
    pallet: string
    weightKg: number
    product: string
  }) => {
    setState((current) => {
      const sequence = 2302 + current.missions.length
      const mission: Mission = {
        id: `MSN-${sequence}`,
        pallet: input.pallet || `PALLET-${900 + current.missions.length}`,
        sscc: `178612340000${String(9000 + current.missions.length).padStart(6, "0")}`.slice(0, 18),
        origin: input.origin,
        destination: input.destination,
        priority: input.priority,
        status: "PENDING",
        progress: 0,
        createdAt: clock(),
        dueAt: new Date(Date.now() + 45 * 60_000).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
        weightKg: input.weightKg,
        product: input.product,
      }
      return { ...current, missions: [mission, ...current.missions] }
    })
  }

  const cancelMission = (missionId: string) => setState((current) => ({
    ...current,
    missions: current.missions.map((mission) => mission.id === missionId ? { ...mission, status: "CANCELLED", progress: 0 } : mission),
    robots: current.robots.map((robot) => robot.missionId === missionId
      ? { ...robot, status: "AVAILABLE", missionId: undefined, payload: undefined, route: [] }
      : robot),
  }))

  const robotAction = (robotId: string, action: "PAUSE" | "RESUME" | "CHARGE" | "OFFLINE" | "RECOVER") => {
    setState((current) => ({
      ...current,
      robots: current.robots.map((robot) => {
        if (robot.id !== robotId) return robot
        if (action === "PAUSE" && !["OFFLINE", "CHARGING"].includes(robot.status)) return { ...robot, status: "PAUSED" }
        if (action === "RESUME" && robot.status === "PAUSED") {
          return { ...robot, status: robot.missionId ? (robot.payload ? "MOVING_TO_DESTINATION" : "MOVING_TO_PICKUP") : "AVAILABLE" }
        }
        if (action === "CHARGE" && robot.status === "AVAILABLE") {
          const route = shortestPath(current.nodes, current.edges, robot.nodeId, "CHARGER-01", current.robots)
          if (route.length <= 1) return { ...robot, status: "CHARGING" }
          return { ...robot, status: "MOVING_TO_DESTINATION", route, routeIndex: 0, segmentProgress: 0, targetMode: "CHARGE" }
        }
        if (action === "OFFLINE") return { ...robot, status: "OFFLINE", route: [] }
        if (action === "RECOVER") {
          const mission = current.missions.find((item) => item.id === robot.missionId)
          if (!mission) return { ...robot, status: "AVAILABLE", missionId: undefined, payload: undefined, route: [] }
          const headingToDestination = ["IN_TRANSIT", "DELIVERY"].includes(mission.status)
          const target = headingToDestination ? mission.destination : mission.origin
          const route = shortestPath(current.nodes, current.edges, robot.nodeId, target, current.robots)
          if (!route.length) return robot
          return {
            ...robot,
            status: headingToDestination ? "MOVING_TO_DESTINATION" : "MOVING_TO_PICKUP",
            route,
            routeIndex: 0,
            segmentProgress: 0,
          }
        }
        return robot
      }),
    }))
  }

  const updateIncident = (id: string, status: Incident["status"]) => setState((current) => ({
    ...current,
    incidents: current.incidents.map((incident) => incident.id === id ? { ...incident, status } : incident),
  }))

  const toggleEdge = (edgeId: string) => setState((current) => {
    const target = current.edges.find((edge) => edge.id === edgeId)
    if (!target) return current
    const nowBlocked = !target.blocked
    const incidents = nowBlocked
      ? [{
          id: `INC-${Date.now()}`, severity: "MEDIUM" as const, type: "MAP_CHANGE",
          status: "OPEN" as const, message: `Segmento ${target.from} – ${target.to} bloqueado manualmente`,
          zone: target.from, createdAt: clock(),
        }, ...current.incidents]
      : current.incidents
    return {
      ...current,
      edges: current.edges.map((edge) => edge.id === edgeId ? { ...edge, blocked: nowBlocked } : edge),
      incidents,
    }
  })

  const addNode = (node: Omit<MapNode, "id">) => setState((current) => {
    const id = `${node.type}-${String(current.nodes.length + 1).padStart(2, "0")}`
    return { ...current, nodes: [...current.nodes, { ...node, id }] }
  })

  const addEdge = (from: string, to: string, oneWay: boolean) => setState((current) => {
    if (from === to || current.edges.some((edge) =>
      (edge.from === from && edge.to === to) || (!edge.oneWay && edge.from === to && edge.to === from),
    )) return current
    const id = `E-${String(current.edges.length + 1).padStart(2, "0")}`
    return { ...current, edges: [...current.edges, { id, from, to, oneWay, blocked: false }] }
  })

  const runScenario = (scenario: string) => {
    if (scenario === "reset") {
      setState(initialState())
      setRunning(true)
      setSpeed(1)
      return
    }
    if (scenario === "urgent") {
      setState((current) => {
        const id = `MSN-${2302 + current.missions.length}`
        const mission: Mission = {
          id, pallet: "PALLET-URGENTE",
          sscc: `178612340000${String(9000 + current.missions.length).padStart(6, "0")}`.slice(0, 18),
          origin: "RACK-B01", destination: "DOCK-01", priority: "CRITICAL",
          status: "PENDING", progress: 0, createdAt: clock(),
          dueAt: new Date(Date.now() + 15 * 60_000).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }),
          weightKg: 420, product: "Despacho urgente",
        }
        return assignment({ ...current, missions: [mission, ...current.missions] }, id)
      })
      return
    }
    setState((current) => {
      if (scenario === "blocked") {
        const edge = current.edges.find((item) => item.id === "E-08")!
        return {
          ...current,
          edges: current.edges.map((item) => item.id === edge.id ? { ...item, blocked: true } : item),
          incidents: [{ id: `INC-${Date.now()}`, severity: "HIGH", type: "ROUTE_BLOCKED", status: "OPEN", message: "Pallet temporal bloquea acceso a Staging 01", zone: "J-03", createdAt: clock() }, ...current.incidents],
        }
      }
      if (scenario === "battery") {
        return { ...current, robots: current.robots.map((robot, index) => index === 0 ? { ...robot, battery: 12 } : robot) }
      }
      if (scenario === "offline") {
        const target = current.robots[1]
        return {
          ...current,
          robots: current.robots.map((robot) => robot.id === target.id ? { ...robot, status: "OFFLINE", route: [] } : robot),
          incidents: [{ id: `INC-${Date.now()}`, severity: "CRITICAL", type: "ROBOT_OFFLINE", status: "OPEN", message: `${target.id} dejó de enviar heartbeat`, zone: target.nodeId, robotId: target.id, missionId: target.missionId, createdAt: clock() }, ...current.incidents],
        }
      }
      if (scenario === "dock") {
        return {
          ...current,
          edges: current.edges.map((edge) => ["E-10", "E-11"].includes(edge.id) ? { ...edge, blocked: true } : edge),
          incidents: [{ id: `INC-${Date.now()}`, severity: "HIGH", type: "DOCK_OCCUPIED", status: "OPEN", message: "Muelle 01 ocupado por transporte externo", zone: "DOCK-01", createdAt: clock() }, ...current.incidents],
        }
      }
      if (scenario === "normal") {
        return { ...current, edges: current.edges.map((edge) => ({ ...edge, blocked: false })), robots: current.robots.map((robot) => robot.status === "OFFLINE" ? { ...robot, status: "AVAILABLE" } : robot) }
      }
      return current
    })
  }

  const stats = useMemo(() => ({
    active: state.robots.filter((robot) => ["MOVING_TO_PICKUP", "MOVING_TO_DESTINATION", "LOADING", "UNLOADING"].includes(robot.status)).length,
    available: state.robots.filter((robot) => robot.status === "AVAILABLE").length,
    openIncidents: state.incidents.filter((incident) => incident.status !== "RESOLVED").length,
    pending: state.missions.filter((mission) => mission.status === "PENDING").length,
    completed: state.missions.filter((mission) => mission.status === "COMPLETED").length,
    utilization: Math.round((state.robots.filter((robot) => !["AVAILABLE", "OFFLINE"].includes(robot.status)).length / state.robots.length) * 100),
  }), [state])

  return {
    ...state, running, speed, stats,
    setRunning, setSpeed, assignMission, assignAll, createMission, cancelMission,
    robotAction, updateIncident, toggleEdge, addNode, addEdge, runScenario,
  }
}
