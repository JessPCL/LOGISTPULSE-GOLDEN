"use client"

import { useMemo, useState } from "react"
import {
  Activity, AlertTriangle, BatteryCharging, Bot, Box, Cable, CheckCircle2, CirclePause,
  CirclePlay, Clock3, Command, Copy, Gauge, LayoutDashboard, ListTodo, Map, MapPin,
  Navigation, PackageCheck, Pause, Play, Plus, RefreshCw, Route, ScanLine,
  ShieldAlert, Siren, SlidersHorizontal, Truck, Warehouse, Wifi, WifiOff, XCircle,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { FactoryMap } from "@/components/factory-map"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Toaster } from "@/components/ui/sonner"
import { usePulseFleet } from "@/hooks/use-pulsefleet"
import { useUnrealBridge, type BridgeStatus } from "@/hooks/use-unreal-bridge"
import {
  missionStatusLabel, statusLabel, type Incident, type MapNode, type Mission,
  type Priority, type Robot, type ScreenId,
} from "@/lib/pulsefleet"
import { buildUnrealSnapshot } from "@/lib/unreal-bridge"
import { cn } from "@/lib/utils"

const screens: { id: ScreenId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "control", label: "Mission Control", icon: LayoutDashboard },
  { id: "fleet", label: "Fleet Overview", icon: Bot },
  { id: "missions", label: "Mission Board", icon: ListTodo },
  { id: "incidents", label: "Incident Center", icon: ShieldAlert },
  { id: "map", label: "Map Editor", icon: Map },
  { id: "scenarios", label: "Scenario Simulator", icon: SlidersHorizontal },
]

const screenTitles: Record<ScreenId, { title: string; subtitle: string }> = {
  control: { title: "Mission Control", subtitle: "Operación de la planta en tiempo real" },
  fleet: { title: "Fleet Overview", subtitle: "Estado, capacidad y salud de cada AMR" },
  missions: { title: "Mission Board", subtitle: "Cola de trabajo y trazabilidad por pallet" },
  incidents: { title: "Incident Center", subtitle: "Excepciones, respuesta y recuperación" },
  map: { title: "Map Editor", subtitle: "Rutas, nodos y restricciones operativas" },
  scenarios: { title: "Scenario Simulator", subtitle: "Pruebas controladas de la operación" },
}

const priorityClass: Record<Priority, string> = {
  CRITICAL: "border-red-200 bg-red-50 text-red-700",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700",
  NORMAL: "border-blue-200 bg-blue-50 text-blue-700",
  LOW: "border-slate-200 bg-slate-50 text-slate-600",
}

const robotStatusClass: Record<Robot["status"], string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ASSIGNED: "bg-sky-50 text-sky-700 border-sky-200",
  MOVING_TO_PICKUP: "bg-sky-50 text-sky-700 border-sky-200",
  LOADING: "bg-amber-50 text-amber-700 border-amber-200",
  MOVING_TO_DESTINATION: "bg-blue-50 text-blue-700 border-blue-200",
  UNLOADING: "bg-amber-50 text-amber-700 border-amber-200",
  CHARGING: "bg-violet-50 text-violet-700 border-violet-200",
  BLOCKED: "bg-orange-50 text-orange-700 border-orange-200",
  OFFLINE: "bg-slate-100 text-slate-600 border-slate-200",
  PAUSED: "bg-yellow-50 text-yellow-700 border-yellow-200",
}

function MetricCard({ label, value, detail, icon: Icon, accent }: {
  label: string; value: string | number; detail: string; icon: typeof Activity; accent: string
}) {
  return (
    <Card className="overflow-hidden border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p>
        </div>
        <div className={cn("grid size-10 place-items-center rounded-xl", accent)}><Icon className="size-5" /></div>
      </CardContent>
    </Card>
  )
}

function CreateMissionDialog({ nodes, onCreate }: {
  nodes: MapNode[]
  onCreate: (input: { origin: string; destination: string; priority: Priority; pallet: string; weightKg: number; product: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState("RACK-A01")
  const [destination, setDestination] = useState("STAGING-01")
  const [priority, setPriority] = useState<Priority>("NORMAL")
  const [pallet, setPallet] = useState("")
  const [weight, setWeight] = useState("420")
  const [product, setProduct] = useState("Producto terminado")

  const submit = () => {
    if (origin === destination) {
      toast.error("Origen y destino deben ser diferentes")
      return
    }
    onCreate({ origin, destination, priority, pallet, weightKg: Number(weight) || 0, product })
    toast.success("Misión creada y añadida a la cola")
    setOpen(false)
    setPallet("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-cyan-600 text-white hover:bg-cyan-700"><Plus className="size-4" />Nueva misión</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Crear misión de transporte</DialogTitle>
          <DialogDescription>PULSEFLEET seleccionará el robot según distancia, batería y capacidad.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="origin">Origen</Label>
            <NativeSelect id="origin" className="w-full" value={origin} onChange={(event) => setOrigin(event.target.value)}>
              {nodes.filter((node) => ["RACK", "STAGING"].includes(node.type)).map((node) => <NativeSelectOption key={node.id} value={node.id}>{node.label}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="destination">Destino</Label>
            <NativeSelect id="destination" className="w-full" value={destination} onChange={(event) => setDestination(event.target.value)}>
              {nodes.filter((node) => ["STAGING", "DOCK"].includes(node.type)).map((node) => <NativeSelectOption key={node.id} value={node.id}>{node.label}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pallet">Pallet / unidad logística</Label>
            <Input id="pallet" value={pallet} onChange={(event) => setPallet(event.target.value.toUpperCase())} placeholder="PALLET-901" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Prioridad</Label>
            <NativeSelect id="priority" className="w-full" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              <NativeSelectOption value="CRITICAL">Crítica</NativeSelectOption>
              <NativeSelectOption value="HIGH">Alta</NativeSelectOption>
              <NativeSelectOption value="NORMAL">Normal</NativeSelectOption>
              <NativeSelectOption value="LOW">Baja</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="product">Contenido</Label>
            <Input id="product" value={product} onChange={(event) => setProduct(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Peso (kg)</Label>
            <Input id="weight" min="1" max="1200" type="number" value={weight} onChange={(event) => setWeight(event.target.value)} />
          </div>
        </div>
        <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-900">
          <ScanLine className="mr-2 inline size-4" />El SSCC se generará automáticamente para la unidad logística.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} className="bg-cyan-600 text-white hover:bg-cyan-700">Crear misión</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RobotDetailSheet({ robot, open, onOpenChange, onAction }: {
  robot?: Robot
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: (id: string, action: "PAUSE" | "RESUME" | "CHARGE" | "OFFLINE" | "RECOVER") => void
}) {
  if (!robot) return null
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b">
          <div className="mb-2 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-slate-950 text-cyan-300"><Bot className="size-6" /></div>
            <div><SheetTitle className="text-xl">{robot.id}</SheetTitle><SheetDescription>{robot.model} · {robot.capacityKg} kg</SheetDescription></div>
          </div>
        </SheetHeader>
        <div className="space-y-5 p-4">
          <Badge variant="outline" className={robotStatusClass[robot.status]}>{statusLabel[robot.status]}</Badge>
          <div>
            <div className="mb-2 flex justify-between text-sm"><span>Batería</span><strong>{Math.round(robot.battery)}%</strong></div>
            <Progress value={robot.battery} className="h-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Ubicación</p><p className="mt-1 font-semibold">{robot.nodeId}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Velocidad</p><p className="mt-1 font-semibold">{robot.speed} m/s</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Misión actual</p><p className="mt-1 font-semibold">{robot.missionId ?? "—"}</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Carga</p><p className="mt-1 font-semibold">{robot.payload ?? "Sin carga"}</p></div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold">Rendimiento de hoy</p>
            <div className="mt-3 flex justify-between text-sm text-slate-600"><span>Misiones completadas</span><strong className="text-slate-950">{robot.completedToday}</strong></div>
            <div className="mt-2 flex justify-between text-sm text-slate-600"><span>Distancia</span><strong className="text-slate-950">{robot.distanceKm.toFixed(1)} km</strong></div>
            <div className="mt-2 flex justify-between text-sm text-slate-600"><span>Último heartbeat</span><strong className="text-emerald-700">{robot.lastSeen}</strong></div>
          </div>
        </div>
        <SheetFooter className="grid grid-cols-2 border-t">
          {robot.status === "PAUSED" ? (
            <Button variant="outline" onClick={() => onAction(robot.id, "RESUME")}><Play className="size-4" />Reanudar</Button>
          ) : (
            <Button variant="outline" onClick={() => onAction(robot.id, "PAUSE")} disabled={robot.status === "OFFLINE"}><Pause className="size-4" />Pausar</Button>
          )}
          <Button variant="outline" onClick={() => onAction(robot.id, "CHARGE")} disabled={robot.status !== "AVAILABLE"}><BatteryCharging className="size-4" />Recargar</Button>
          {robot.status === "OFFLINE" || robot.status === "BLOCKED" ? (
            <Button className="col-span-2" onClick={() => onAction(robot.id, "RECOVER")}><RefreshCw className="size-4" />Recuperar AMR</Button>
          ) : (
            <Button className="col-span-2" variant="destructive" onClick={() => onAction(robot.id, "OFFLINE")}><WifiOff className="size-4" />Simular desconexión</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function MissionControl({ engine, selectRobot }: { engine: ReturnType<typeof usePulseFleet>; selectRobot: (id: string) => void }) {
  const liveMissions = engine.missions.filter((mission) => !["COMPLETED", "CANCELLED"].includes(mission.status)).slice(0, 5)
  const alerts = engine.incidents.filter((incident) => incident.status !== "RESOLVED").slice(0, 4)
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="AMR activos" value={`${engine.stats.active}/${engine.robots.length}`} detail={`${engine.stats.available} disponibles`} icon={Bot} accent="bg-cyan-50 text-cyan-700" />
        <MetricCard label="Utilización" value={`${engine.stats.utilization}%`} detail="Flota asignada o en carga" icon={Gauge} accent="bg-blue-50 text-blue-700" />
        <MetricCard label="Misiones pendientes" value={engine.stats.pending} detail={`${engine.stats.completed} completadas`} icon={PackageCheck} accent="bg-emerald-50 text-emerald-700" />
        <MetricCard label="Incidentes abiertos" value={engine.stats.openIncidents} detail="Requieren seguimiento" icon={Siren} accent="bg-orange-50 text-orange-700" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="border-slate-200 p-3 shadow-sm">
          <FactoryMap nodes={engine.nodes} edges={engine.edges} robots={engine.robots} onRobotSelect={selectRobot} />
        </Card>
        <div className="space-y-5">
          <Card className="border-slate-200">
            <CardHeader className="pb-3"><CardTitle className="text-base">Operación en curso</CardTitle><CardDescription>Misiones activas y en espera</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {liveMissions.map((mission) => (
                <button key={mission.id} className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/40">
                  <div className="flex items-center justify-between gap-2"><strong className="text-sm">{mission.id}</strong><Badge variant="outline" className={priorityClass[mission.priority]}>{mission.priority}</Badge></div>
                  <p className="mt-1 truncate text-sm text-slate-600">{mission.pallet} · {mission.origin} → {mission.destination}</p>
                  <div className="mt-3 flex items-center gap-2"><Progress value={mission.progress} className="h-1.5" /><span className="text-xs font-semibold text-slate-500">{mission.progress}%</span></div>
                </button>
              ))}
              {!liveMissions.length && <p className="py-4 text-center text-sm text-slate-500">No hay misiones activas.</p>}
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardHeader className="pb-3"><CardTitle className="text-base">Alertas recientes</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((incident) => (
                <div key={incident.id} className="flex gap-3 rounded-xl bg-orange-50 p-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-600" />
                  <div><p className="text-sm font-semibold text-orange-950">{incident.message}</p><p className="mt-1 text-xs text-orange-700">{incident.zone} · {incident.createdAt}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function FleetOverview({ engine, selectRobot }: { engine: ReturnType<typeof usePulseFleet>; selectRobot: (id: string) => void }) {
  const [filter, setFilter] = useState("ALL")
  const robots = filter === "ALL" ? engine.robots : engine.robots.filter((robot) => robot.status === filter)
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        {engine.robots.map((robot) => (
          <button key={robot.id} onClick={() => selectRobot(robot.id)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md">
            <div className="flex items-start justify-between"><div className="grid size-11 place-items-center rounded-xl bg-slate-950 text-cyan-300"><Bot className="size-6" /></div><Badge variant="outline" className={robotStatusClass[robot.status]}>{statusLabel[robot.status]}</Badge></div>
            <div className="mt-5 flex items-end justify-between"><div><p className="text-xl font-bold">{robot.id}</p><p className="text-sm text-slate-500">{robot.model} · {robot.capacityKg} kg</p></div><span className="text-2xl font-bold text-slate-800">{Math.round(robot.battery)}%</span></div>
            <Progress value={robot.battery} className="mt-3 h-2" />
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><span className="rounded-lg bg-slate-50 p-2 text-slate-600"><MapPin className="mr-1 inline size-3.5" />{robot.nodeId}</span><span className="rounded-lg bg-slate-50 p-2 text-slate-600"><PackageCheck className="mr-1 inline size-3.5" />{robot.completedToday} hoy</span></div>
          </button>
        ))}
      </div>
      <Card className="border-slate-200">
        <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Registro de flota</CardTitle><CardDescription>Telemetría consolidada</CardDescription></div><NativeSelect value={filter} onChange={(event) => setFilter(event.target.value)}><NativeSelectOption value="ALL">Todos</NativeSelectOption><NativeSelectOption value="AVAILABLE">Disponibles</NativeSelectOption><NativeSelectOption value="MOVING_TO_DESTINATION">En tránsito</NativeSelectOption><NativeSelectOption value="OFFLINE">Desconectados</NativeSelectOption></NativeSelect></CardHeader>
        <CardContent>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Robot</TableHead><TableHead>Estado</TableHead><TableHead>Batería</TableHead><TableHead>Ubicación</TableHead><TableHead>Misión</TableHead><TableHead>Distancia</TableHead></TableRow></TableHeader><TableBody>
            {robots.map((robot) => <TableRow key={robot.id} className="cursor-pointer" onClick={() => selectRobot(robot.id)}><TableCell className="font-semibold">{robot.id}</TableCell><TableCell><Badge variant="outline" className={robotStatusClass[robot.status]}>{statusLabel[robot.status]}</Badge></TableCell><TableCell className="min-w-32"><div className="flex items-center gap-2"><Progress value={robot.battery} className="h-1.5" /><span>{Math.round(robot.battery)}%</span></div></TableCell><TableCell>{robot.nodeId}</TableCell><TableCell>{robot.missionId ?? "—"}</TableCell><TableCell>{robot.distanceKm.toFixed(1)} km</TableCell></TableRow>)}
          </TableBody></Table></div>
        </CardContent>
      </Card>
    </div>
  )
}

const boardColumns: { key: string; title: string; statuses: Mission["status"][] }[] = [
  { key: "pending", title: "Pendientes", statuses: ["PENDING"] },
  { key: "assigned", title: "Asignadas", statuses: ["ASSIGNED", "PICKUP"] },
  { key: "transit", title: "En ejecución", statuses: ["IN_TRANSIT", "DELIVERY"] },
  { key: "done", title: "Finalizadas", statuses: ["COMPLETED", "FAILED", "CANCELLED"] },
]

function MissionBoard({ engine }: { engine: ReturnType<typeof usePulseFleet> }) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {boardColumns.map((column) => {
        const missions = engine.missions.filter((mission) => column.statuses.includes(mission.status))
        return (
          <section key={column.key} className="min-h-[520px] rounded-2xl bg-slate-100/70 p-3">
            <div className="mb-3 flex items-center justify-between px-1"><h2 className="font-bold text-slate-800">{column.title}</h2><Badge variant="secondary">{missions.length}</Badge></div>
            <div className="space-y-3">
              {missions.map((mission) => (
                <Card key={mission.id} className="gap-3 border-slate-200 py-4 shadow-sm">
                  <CardContent className="px-4">
                    <div className="flex items-center justify-between gap-2"><strong>{mission.id}</strong><Badge variant="outline" className={priorityClass[mission.priority]}>{mission.priority}</Badge></div>
                    <p className="mt-2 text-sm font-semibold text-slate-800">{mission.pallet}</p>
                    <p className="mt-1 text-xs text-slate-500">SSCC {mission.sscc}</p>
                    <div className="my-3 flex items-center gap-2 text-sm text-slate-600"><MapPin className="size-4 text-cyan-600" /><span>{mission.origin}</span><Route className="size-4" /><span>{mission.destination}</span></div>
                    <Progress value={mission.progress} className="h-1.5" />
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span><Clock3 className="mr-1 inline size-3" />{mission.dueAt}</span><span>{mission.robotId ?? "Sin asignar"}</span></div>
                    {mission.status === "PENDING" && <Button size="sm" className="mt-3 w-full" onClick={() => { engine.assignMission(mission.id); toast.info("Asignación solicitada") }}>Asignar AMR</Button>}
                    {!(["COMPLETED", "FAILED", "CANCELLED"] as Mission["status"][]).includes(mission.status) && mission.status !== "PENDING" && <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => engine.cancelMission(mission.id)}>Cancelar misión</Button>}
                    {column.key === "done" && <p className="mt-3 text-xs font-semibold text-slate-500">{missionStatusLabel[mission.status]}</p>}
                  </CardContent>
                </Card>
              ))}
              {!missions.length && <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Sin misiones</div>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function IncidentCenter({ engine }: { engine: ReturnType<typeof usePulseFleet> }) {
  const [filter, setFilter] = useState("ACTIVE")
  const incidents = engine.incidents.filter((incident) => filter === "ALL" || (filter === "ACTIVE" ? incident.status !== "RESOLVED" : incident.severity === filter))
  const severityIcon = (incident: Incident) => incident.severity === "CRITICAL" ? <Siren className="size-5 text-red-600" /> : <AlertTriangle className="size-5 text-orange-600" />
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="border-slate-200">
        <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Registro de incidentes</CardTitle><CardDescription>Eventos y acciones de recuperación</CardDescription></div><NativeSelect value={filter} onChange={(event) => setFilter(event.target.value)}><NativeSelectOption value="ACTIVE">Activos</NativeSelectOption><NativeSelectOption value="ALL">Todos</NativeSelectOption><NativeSelectOption value="CRITICAL">Críticos</NativeSelectOption><NativeSelectOption value="HIGH">Altos</NativeSelectOption></NativeSelect></CardHeader>
        <CardContent className="space-y-3">
          {incidents.map((incident) => (
            <div key={incident.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">{severityIcon(incident)}<div><div className="flex flex-wrap items-center gap-2"><strong>{incident.type.replaceAll("_", " ")}</strong><Badge variant="outline">{incident.severity}</Badge><Badge variant="secondary">{incident.status}</Badge></div><p className="mt-2 text-sm text-slate-700">{incident.message}</p><p className="mt-2 text-xs text-slate-500">{incident.id} · {incident.zone} · {incident.robotId ?? "Infraestructura"} · {incident.createdAt}</p></div></div>
                <div className="flex shrink-0 gap-2">
                  {incident.status === "OPEN" && <Button size="sm" variant="outline" onClick={() => engine.updateIncident(incident.id, "ACKNOWLEDGED")}>Reconocer</Button>}
                  {incident.status !== "RESOLVED" && <Button size="sm" onClick={() => engine.updateIncident(incident.id, "RESOLVED")}><CheckCircle2 className="size-4" />Resolver</Button>}
                </div>
              </div>
            </div>
          ))}
          {!incidents.length && <div className="py-12 text-center"><CheckCircle2 className="mx-auto size-9 text-emerald-600" /><p className="mt-3 font-semibold">No hay incidentes con este filtro</p></div>}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card className="border-slate-200"><CardHeader><CardTitle className="text-base">Tiempo de respuesta</CardTitle></CardHeader><CardContent><p className="text-4xl font-bold">02:18</p><p className="mt-1 text-sm text-slate-500">Promedio de reconocimiento</p><div className="mt-5 grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-red-50 p-3"><p className="text-xl font-bold text-red-700">{engine.incidents.filter((i) => i.severity === "CRITICAL" && i.status !== "RESOLVED").length}</p><p className="text-xs text-red-600">Críticos</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-xl font-bold text-emerald-700">{engine.incidents.filter((i) => i.status === "RESOLVED").length}</p><p className="text-xs text-emerald-600">Resueltos</p></div></div></CardContent></Card>
        <Card className="border-slate-200 bg-slate-950 text-white"><CardHeader><CardTitle className="text-base text-white">Probar respuesta</CardTitle><CardDescription className="text-slate-400">Inyecta un evento controlado</CardDescription></CardHeader><CardContent className="space-y-2"><Button className="w-full bg-orange-500 text-white hover:bg-orange-600" onClick={() => engine.runScenario("blocked")}><AlertTriangle className="size-4" />Bloquear ruta</Button><Button variant="outline" className="w-full border-slate-700 bg-transparent text-white hover:bg-slate-800 hover:text-white" onClick={() => engine.runScenario("offline")}><WifiOff className="size-4" />Desconectar AMR</Button></CardContent></Card>
      </div>
    </div>
  )
}

const bridgeStatusLabel: Record<BridgeStatus, string> = {
  disconnected: "Desconectado", connecting: "Conectando…", connected: "Conectado", error: "Error de conexión",
}

function UnrealBridgePanel({ engine }: { engine: ReturnType<typeof usePulseFleet> }) {
  const [url, setUrl] = useState("ws://localhost:8787")
  const [enabled, setEnabled] = useState(false)
  const { status } = useUnrealBridge({
    url,
    enabled,
    state: engine,
    onToggleEdge: engine.toggleEdge,
    onRobotAction: engine.robotAction,
  })

  const copySnapshot = async () => {
    const snapshot = buildUnrealSnapshot(engine)
    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2))
    toast.success("Snapshot JSON copiado (formato pulsefleet.unreal.v1)")
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Cable className="size-4" />Puente Unreal Engine 5</CardTitle>
        <CardDescription>Transmite el gemelo digital (nodos, rutas, robots) a un proyecto UE5 vía WebSocket.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="bridge-url">URL del puente</Label>
          <Input id="bridge-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="ws://localhost:8787" />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {status === "connected" ? <Wifi className="size-4 text-emerald-600" /> : <WifiOff className="size-4 text-slate-400" />}
            {bridgeStatusLabel[status]}
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Activar puente Unreal" />
        </div>
        <Button variant="outline" className="w-full" onClick={copySnapshot}>
          <Copy className="size-4" />Copiar snapshot JSON
        </Button>
        <p className="text-xs leading-5 text-slate-500">
          Ejecuta <code className="rounded bg-slate-100 px-1">npm run bridge:server</code> y conecta tu proyecto UE5 a la misma URL. El snapshot usa metros ({buildUnrealSnapshot(engine).metersPerUnit} u/px) y ángulo de robot en grados.
        </p>
      </CardContent>
    </Card>
  )
}

function MapEditor({ engine }: { engine: ReturnType<typeof usePulseFleet> }) {
  const [label, setLabel] = useState("Nueva estación")
  const [type, setType] = useState<MapNode["type"]>("STAGING")
  const [x, setX] = useState("820")
  const [y, setY] = useState("520")
  const [edgeFrom, setEdgeFrom] = useState("J-03")
  const [edgeTo, setEdgeTo] = useState("STAGING-01")
  const [oneWay, setOneWay] = useState(false)
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <Card className="border-slate-200 p-3"><FactoryMap nodes={engine.nodes} edges={engine.edges} robots={engine.robots} editable onEdgeSelect={(id) => { engine.toggleEdge(id); toast.info("Estado del segmento actualizado") }} /></Card>
      <div className="space-y-4">
        <Card className="border-slate-200"><CardHeader><CardTitle className="text-base">Edición de rutas</CardTitle><CardDescription>Selecciona un segmento en el mapa para bloquearlo o habilitarlo.</CardDescription></CardHeader><CardContent className="space-y-2"><div className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>Versión del mapa</span><strong>PLANTA-V1.3</strong></div><div className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>Nodos</span><strong>{engine.nodes.length}</strong></div><div className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>Segmentos bloqueados</span><strong className="text-red-600">{engine.edges.filter((edge) => edge.blocked).length}</strong></div></CardContent></Card>
        <Card className="border-slate-200"><CardHeader><CardTitle className="text-base">Añadir nodo</CardTitle></CardHeader><CardContent className="space-y-3"><div className="space-y-1.5"><Label htmlFor="node-label">Nombre</Label><Input id="node-label" value={label} onChange={(event) => setLabel(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="node-type">Tipo</Label><NativeSelect id="node-type" className="w-full" value={type} onChange={(event) => setType(event.target.value as MapNode["type"])}><NativeSelectOption value="RACK">Rack</NativeSelectOption><NativeSelectOption value="STAGING">Staging</NativeSelectOption><NativeSelectOption value="DOCK">Muelle</NativeSelectOption><NativeSelectOption value="CHARGER">Cargador</NativeSelectOption><NativeSelectOption value="JUNCTION">Cruce</NativeSelectOption></NativeSelect></div><div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label htmlFor="node-x">X</Label><Input id="node-x" type="number" value={x} onChange={(event) => setX(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="node-y">Y</Label><Input id="node-y" type="number" value={y} onChange={(event) => setY(event.target.value)} /></div></div><Button className="w-full" onClick={() => { engine.addNode({ label, type, x: Number(x), y: Number(y) }); toast.success("Nodo añadido al mapa") }}><Plus className="size-4" />Añadir nodo</Button></CardContent></Card>
        <Card className="border-slate-200"><CardHeader><CardTitle className="text-base">Conectar nodos</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label htmlFor="edge-from">Desde</Label><NativeSelect id="edge-from" className="w-full" value={edgeFrom} onChange={(event) => setEdgeFrom(event.target.value)}>{engine.nodes.map((node) => <NativeSelectOption key={node.id} value={node.id}>{node.id}</NativeSelectOption>)}</NativeSelect></div><div className="space-y-1.5"><Label htmlFor="edge-to">Hasta</Label><NativeSelect id="edge-to" className="w-full" value={edgeTo} onChange={(event) => setEdgeTo(event.target.value)}>{engine.nodes.map((node) => <NativeSelectOption key={node.id} value={node.id}>{node.id}</NativeSelectOption>)}</NativeSelect></div></div><div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><Label htmlFor="one-way">Un solo sentido</Label><Switch id="one-way" checked={oneWay} onCheckedChange={setOneWay} /></div><Button variant="outline" className="w-full" onClick={() => { engine.addEdge(edgeFrom, edgeTo, oneWay); toast.success("Conexión añadida") }}><Route className="size-4" />Crear conexión</Button></CardContent></Card>
        <UnrealBridgePanel engine={engine} />
      </div>
    </div>
  )
}

const scenarios = [
  { id: "normal", title: "Operación normal", description: "Limpia bloqueos y restablece conectividad.", icon: CirclePlay, tone: "cyan" },
  { id: "urgent", title: "Orden urgente", description: "Crea una misión crítica hacia el muelle.", icon: Zap, tone: "red" },
  { id: "blocked", title: "Pasillo bloqueado", description: "Cierra el acceso principal a Staging 01.", icon: AlertTriangle, tone: "orange" },
  { id: "battery", title: "Batería crítica", description: "Reduce AMR-01 al 12% de batería.", icon: BatteryCharging, tone: "violet" },
  { id: "offline", title: "Pérdida de conexión", description: "Interrumpe el heartbeat de AMR-02.", icon: WifiOff, tone: "slate" },
  { id: "dock", title: "Muelle ocupado", description: "Bloquea las rutas de acceso al muelle.", icon: Truck, tone: "blue" },
]

function ScenarioSimulator({ engine }: { engine: ReturnType<typeof usePulseFleet> }) {
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-lg"><CardContent className="grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:items-center"><div><Badge className="bg-cyan-400 text-slate-950 hover:bg-cyan-400">LABORATORIO ACTIVO</Badge><h2 className="mt-4 text-2xl font-bold">Control de simulación</h2><p className="mt-2 max-w-2xl text-slate-400">Inyecta condiciones operativas y observa cómo responde la flota, sin afectar un robot real.</p></div><div className="rounded-2xl border border-slate-700 bg-slate-900 p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold">Velocidad</span><strong className="text-cyan-300">{engine.speed.toFixed(1)}×</strong></div><Slider value={[engine.speed]} min={0.5} max={3} step={0.5} onValueChange={(value) => engine.setSpeed(value[0])} className="my-4" /><div className="flex gap-2"><Button className="flex-1 bg-cyan-500 text-slate-950 hover:bg-cyan-400" onClick={() => engine.setRunning(!engine.running)}>{engine.running ? <><Pause className="size-4" />Pausar</> : <><Play className="size-4" />Continuar</>}</Button><Button variant="outline" className="border-slate-700 bg-transparent text-white hover:bg-slate-800 hover:text-white" onClick={() => engine.runScenario("reset")}><RefreshCw className="size-4" />Reiniciar</Button></div></div></CardContent></Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((scenario) => {
          const Icon = scenario.icon
          return <Card key={scenario.id} className="border-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"><CardContent className="p-5"><div className={cn("grid size-11 place-items-center rounded-xl", scenario.tone === "red" ? "bg-red-50 text-red-600" : scenario.tone === "orange" ? "bg-orange-50 text-orange-600" : scenario.tone === "violet" ? "bg-violet-50 text-violet-600" : scenario.tone === "blue" ? "bg-blue-50 text-blue-600" : scenario.tone === "slate" ? "bg-slate-100 text-slate-600" : "bg-cyan-50 text-cyan-600")}><Icon className="size-5" /></div><h3 className="mt-4 font-bold">{scenario.title}</h3><p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{scenario.description}</p><Button variant="outline" className="mt-4 w-full" onClick={() => { engine.runScenario(scenario.id); toast.info(`Escenario: ${scenario.title}`) }}>Ejecutar escenario</Button></CardContent></Card>
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Robots conectados" value={engine.robots.filter((robot) => robot.status !== "OFFLINE").length} detail={`de ${engine.robots.length} registrados`} icon={Activity} accent="bg-emerald-50 text-emerald-700" /><MetricCard label="Rutas bloqueadas" value={engine.edges.filter((edge) => edge.blocked).length} detail="segmentos no disponibles" icon={Route} accent="bg-orange-50 text-orange-700" /><MetricCard label="Batería media" value={`${Math.round(engine.robots.reduce((sum, robot) => sum + robot.battery, 0) / engine.robots.length)}%`} detail="estado energético" icon={BatteryCharging} accent="bg-violet-50 text-violet-700" /><MetricCard label="Simulación" value={engine.running ? "Activa" : "Pausada"} detail={`${engine.speed.toFixed(1)}× velocidad`} icon={engine.running ? CirclePlay : CirclePause} accent="bg-cyan-50 text-cyan-700" /></div>
    </div>
  )
}

export function PulseFleetApp() {
  const engine = usePulseFleet()
  const [screen, setScreen] = useState<ScreenId>("control")
  const [selectedRobotId, setSelectedRobotId] = useState<string>()
  const selectedRobot = useMemo(() => engine.robots.find((robot) => robot.id === selectedRobotId), [engine.robots, selectedRobotId])
  const selectRobot = (id: string) => setSelectedRobotId(id)

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r-0 bg-slate-950 text-white">
        <SidebarHeader className="border-b border-white/10 p-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-400 text-slate-950"><Navigation className="size-5" /></div>
            <div className="group-data-[collapsible=icon]:hidden"><p className="text-lg font-black tracking-tight">PULSEFLEET</p><p className="text-xs font-medium text-slate-400">AMR Fleet Manager</p></div>
          </div>
        </SidebarHeader>
        <SidebarContent className="bg-slate-950 px-2 py-4">
          <SidebarGroup>
            <SidebarGroupLabel className="text-slate-500 group-data-[collapsible=icon]:hidden">OPERACIÓN</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {screens.map((item) => {
                  const Icon = item.icon
                  return <SidebarMenuItem key={item.id}><SidebarMenuButton tooltip={item.label} isActive={screen === item.id} onClick={() => setScreen(item.id)} className="h-11 text-slate-300 hover:bg-white/10 hover:text-white data-[active=true]:bg-cyan-400 data-[active=true]:font-bold data-[active=true]:text-slate-950"><Icon className="size-5" /><span>{item.label}</span>{item.id === "incidents" && engine.stats.openIncidents > 0 && <span className="ml-auto rounded-full bg-orange-500 px-2 py-0.5 text-xs text-white group-data-[collapsible=icon]:hidden">{engine.stats.openIncidents}</span>}</SidebarMenuButton></SidebarMenuItem>
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/10 bg-slate-950 p-3">
          <div className="flex items-center gap-3 overflow-hidden rounded-xl bg-white/5 p-2"><span className={cn("size-2.5 shrink-0 rounded-full", engine.running ? "bg-emerald-400" : "bg-amber-400")} /><div className="group-data-[collapsible=icon]:hidden"><p className="text-xs font-semibold">{engine.running ? "Motor activo" : "Simulación pausada"}</p><p className="text-xs text-slate-500">{engine.speed.toFixed(1)}× · datos locales</p></div></div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-[#f4f7fb]">
        <header className="sticky top-0 z-20 flex h-17 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="shrink-0" /><div className="min-w-0"><h1 className="truncate text-lg font-bold text-slate-950">{screenTitles[screen].title}</h1><p className="hidden truncate text-sm text-slate-500 sm:block">{screenTitles[screen].subtitle}</p></div></div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 lg:flex"><span className={cn("size-2 rounded-full", engine.running ? "bg-emerald-500" : "bg-amber-500")} />{engine.running ? "Simulación activa" : "Pausada"} · {engine.speed.toFixed(1)}×</div>
            <Button variant="outline" size="icon" aria-label={engine.running ? "Pausar simulación" : "Reanudar simulación"} onClick={() => engine.setRunning(!engine.running)}>{engine.running ? <Pause className="size-4" /> : <Play className="size-4" />}</Button>
            <Button variant="outline" className="hidden sm:inline-flex" onClick={() => { engine.assignAll(); toast.info("Planificador ejecutado por prioridad") }}><Command className="size-4" />Autoasignar</Button>
            <CreateMissionDialog nodes={engine.nodes} onCreate={engine.createMission} />
          </div>
        </header>

        <div className="p-4 md:p-6">
          {screen === "control" && <MissionControl engine={engine} selectRobot={selectRobot} />}
          {screen === "fleet" && <FleetOverview engine={engine} selectRobot={selectRobot} />}
          {screen === "missions" && <MissionBoard engine={engine} />}
          {screen === "incidents" && <IncidentCenter engine={engine} />}
          {screen === "map" && <MapEditor engine={engine} />}
          {screen === "scenarios" && <ScenarioSimulator engine={engine} />}
        </div>

        <RobotDetailSheet robot={selectedRobot} open={Boolean(selectedRobotId)} onOpenChange={(open) => !open && setSelectedRobotId(undefined)} onAction={(id, action) => { engine.robotAction(id, action); toast.info(`Acción ${action} enviada a ${id}`) }} />
        <Toaster richColors position="bottom-right" />
      </SidebarInset>
    </SidebarProvider>
  )
}
