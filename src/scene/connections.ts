import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { PandoraConnection, PandoraFunction, PandoraNode } from "../model";
import { CONNECTION_DATA_KIND } from "./metadata";
import { portCenter } from "./layout";

export function connectionsToElements(
  nodes: PandoraNode[],
  connections: PandoraConnection[],
  functions: PandoraFunction[] = [],
): ExcalidrawElementSkeleton[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return connections.flatMap((connection) => {
    const from = byId.get(connection.fromNodeId);
    const to = byId.get(connection.toNodeId);
    if (!from || !to) return [];
    const start = portCenter(from, "output", connection.fromPort, functions);
    const end = portCenter(to, "input", connection.toPort, functions);
    return [{
      type: "arrow",
      x: start.x,
      y: start.y,
      points: [
        [0, 0],
        [end.x - start.x, end.y - start.y],
      ],
      endArrowhead: "triangle",
      strokeColor: "#77738a",
      strokeWidth: 2,
      customData: {
        kind: CONNECTION_DATA_KIND,
        connectionId: connection.id,
      },
    }];
  });
}
