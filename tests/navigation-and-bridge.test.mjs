import assert from "node:assert/strict";
import test from "node:test";

import { edgeDistance, shortestPath } from "../lib/pulsefleet.ts";
import { buildUnrealSnapshot } from "../lib/unreal-bridge.ts";

const nodes = [
  { id: "A", label: "A", type: "RACK", x: 0, y: 0 },
  { id: "B", label: "B", type: "JUNCTION", x: 10, y: 0 },
  { id: "C", label: "C", type: "JUNCTION", x: 10, y: 10 },
  { id: "D", label: "D", type: "DOCK", x: 20, y: 0 },
];

const edges = [
  { id: "E1", from: "A", to: "B", blocked: false },
  { id: "E2", from: "B", to: "D", blocked: false },
  { id: "E3", from: "A", to: "C", blocked: false },
  { id: "E4", from: "C", to: "D", blocked: false },
];

test("shortestPath elige el camino de menor distancia real, no el de menos saltos", () => {
  const path = shortestPath(nodes, edges, "A", "D");
  assert.deepEqual(path, ["A", "B", "D"]);
});

test("shortestPath evita segmentos bloqueados", () => {
  const blockedEdges = edges.map((edge) => edge.id === "E1" ? { ...edge, blocked: true } : edge);
  const path = shortestPath(nodes, blockedEdges, "A", "D");
  assert.deepEqual(path, ["A", "C", "D"]);
});

test("shortestPath prefiere una ruta libre aunque sea más larga si la corta está congestionada", () => {
  const busyRobots = Array.from({ length: 5 }, (_, index) => ({
    id: `R${index}`, model: "PF-600", status: "MOVING_TO_DESTINATION", battery: 80,
    capacityKg: 600, nodeId: "A", x: 0, y: 0, speed: 1,
    route: ["A", "B"], routeIndex: 0, segmentProgress: 0, phaseTicks: 0,
    distanceKm: 0, completedToday: 0, lastSeen: "ahora",
  }));
  const path = shortestPath(nodes, edges, "A", "D", busyRobots);
  assert.deepEqual(path, ["A", "C", "D"]);
});

test("edgeDistance calcula la distancia euclidiana entre nodos", () => {
  assert.equal(edgeDistance(nodes, edges[0]), 10);
});

test("buildUnrealSnapshot convierte a metros y calcula el heading del robot", () => {
  const robot = {
    id: "AMR-01", model: "PF-600", status: "MOVING_TO_DESTINATION", battery: 90,
    capacityKg: 600, nodeId: "A", x: 0, y: 0, speed: 1,
    route: ["A", "D"], routeIndex: 0, segmentProgress: 0, phaseTicks: 0,
    distanceKm: 0, completedToday: 0, lastSeen: "ahora",
  };
  const snapshot = buildUnrealSnapshot({ nodes, edges, robots: [robot] });
  assert.equal(snapshot.schema, "pulsefleet.unreal.v1");
  assert.equal(snapshot.robots[0].headingDeg, 0);
  assert.equal(snapshot.nodes.find((node) => node.id === "D").x, 20 * snapshot.metersPerUnit);
});
