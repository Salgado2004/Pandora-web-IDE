import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { PandoraConnection, PandoraFunction, PandoraNode } from "./model";
import { inputPortCount, nodeVisuals, outputPortCount } from "./model";

export const NODE_DATA_KIND = "pandora-node";
export const CONNECTION_DATA_KIND = "pandora-connection";
const NODE_WIDTH = 78;
const NODE_HEIGHT = 68;
const PORT_SIZE = 10;

function portY(index: number, count: number, y: number): number {
  return y + ((index + 1) * NODE_HEIGHT) / (count + 1) - PORT_SIZE / 2;
}

function nodeOutputPortCount(node: PandoraNode): number {
  if (node.type === "lig" && node.functionPort === "output") return 0;
  return outputPortCount(node.type);
}

export function portCenter(
  node: PandoraNode,
  direction: "input" | "output",
  index: number,
  functions: PandoraFunction[] = [],
): { x: number; y: number } {
  const count =
    direction === "input"
      ? nodeInputPortCount(node, functions)
      : nodeOutputPortCount(node);
  return {
    x: node.x + (direction === "input" ? 0 : NODE_WIDTH),
    y: portY(index, count, node.y) + PORT_SIZE / 2,
  };
}

function nodeInputPortCount(node: PandoraNode, functions: PandoraFunction[]): number {
  if (node.type === "lig" && node.functionPort === "input") return 0;
  if (node.type === "lig" && node.functionPort === "output") return 1;
  if (node.type !== "encp") return inputPortCount(node.type);
  return inputPortCount(
    node.type,
    node.functionId
      ? functions.find((item) => item.id === node.functionId)?.parameters.length ?? 0
      : 0,
  );
}

export function nodeToElements(
  node: PandoraNode,
  selectedNodeId: string | null,
  functions: PandoraFunction[] = [],
): ExcalidrawElementSkeleton[] {
  const visual = nodeVisuals[node.type];
  const inputCount = nodeInputPortCount(node, functions);
  const width = NODE_WIDTH;
  const height = NODE_HEIGHT;
  const text =
    node.type === "lig"
      ? node.functionPort
        ? `${node.functionPort}${node.functionPort === "input" ? ` ${node.functionPortIndex ?? 0}` : ""}`
        : selectedNodeId === node.id
          ? String(node.idx ?? node.id)
          : ""
      : node.type === "const" && node.value !== undefined
        ? String(node.value)
        : node.type === "encp"
          ? node.functionName ?? "encp"
        : node.type === "funcao"
          ? node.functionName ?? "função"
        : visual.label;
  const fontSize = ["soma", "subs", "mult", "divs"].includes(node.type)
    ? 48
    : 20;

  const shape = {
    id: `${node.id}-shape`,
    type: visual.shape,
    x: node.x,
    y: node.y,
    width,
    height,
    backgroundColor: visual.color,
    strokeColor: "#34324a",
    strokeWidth: 2,
    customData: {
      kind: NODE_DATA_KIND,
      nodeId: node.id,
      nodeType: node.type,
      functionId: node.functionId,
      role: "shape",
      derivedFrom: node.derivedFrom,
    },
    groupIds: [node.id],
    locked: Boolean(node.derivedFrom),
  } satisfies ExcalidrawElementSkeleton;
  const inputPorts = Array.from({ length: inputCount }, (_, index) => ({
    type: "ellipse",
    id: `${node.id}-input-${index}`,
    x: node.x - PORT_SIZE / 2,
    y: portY(index, inputCount, node.y),
    width: PORT_SIZE,
    height: PORT_SIZE,
    backgroundColor: "#77738a",
    strokeColor: "#34324a",
    customData: {
      kind: "pandora-port",
      nodeId: node.id,
      portType: "input",
      port: index,
    },
    groupIds: [node.id],
    locked: Boolean(node.derivedFrom) || node.type === "funcao",
  } satisfies ExcalidrawElementSkeleton));
  const outputCount = nodeOutputPortCount(node);
  const outputPorts = Array.from({ length: outputCount }, (_, index) => ({
    type: "ellipse",
    id: `${node.id}-output-${index}`,
    x: node.x + width - PORT_SIZE / 2,
    y: portY(index, outputPortCount(node.type), node.y),
    width: PORT_SIZE,
    height: PORT_SIZE,
    backgroundColor: "#77738a",
    strokeColor: "#34324a",
    customData: {
      kind: "pandora-port",
      nodeId: node.id,
      portType: "output",
      port: index,
    },
    groupIds: [node.id],
    locked: Boolean(node.derivedFrom),
  } satisfies ExcalidrawElementSkeleton));
  const portLabels = [
    ...Array.from({ length: inputCount }, (_, index) => ({
      direction: "input" as const,
      index,
      x: node.x - 24,
    })),
    ...Array.from({ length: outputCount }, (_, index) => ({
      direction: "output" as const,
      index,
      x: node.x + width + 8,
    })),
  ].map(({ direction, index, x }) => ({
    type: "text",
    id: `${node.id}-${direction}-label-${index}`,
    x,
    y: portY(
      index,
      direction === "input" ? inputCount : outputCount,
      node.y,
    ),
    text: String(index),
    fontSize: 11,
    fontFamily: 2,
    textAlign: "center",
    verticalAlign: "middle",
    width: 16,
    height: PORT_SIZE,
    customData: {
      kind: "pandora-port",
      nodeId: node.id,
      portType: direction,
      port: index,
    },
    groupIds: [node.id],
    locked: Boolean(node.derivedFrom),
  } satisfies ExcalidrawElementSkeleton));
  if (node.type === "lig" && !node.functionPort && selectedNodeId !== node.id) {
    return [shape, ...inputPorts, ...outputPorts, ...portLabels];
  }

  return [
    shape,
    ...inputPorts,
    ...outputPorts,
    ...portLabels,
    {
      type: "text",
      id: `${node.id}-text`,
      x: node.x + width / 2,
      y: node.y + height / 2,
      text,
      fontSize,
      fontFamily: 2,
      textAlign: "center",
      verticalAlign: "middle",
      width,
      height,
      customData: {
        kind: NODE_DATA_KIND,
        nodeId: node.id,
        nodeType: node.type,
        functionId: node.functionId,
        role: "text",
        derivedFrom: node.derivedFrom,
      },
      groupIds: [node.id],
      locked: Boolean(node.derivedFrom),
    },
  ];
}

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

export function nodesToElements(
  nodes: PandoraNode[],
  connections: PandoraConnection[],
  selectedNodeId: string | null,
  functions: PandoraFunction[] = [],
) {
  return convertToExcalidrawElements(
    [
      ...connectionsToElements(nodes, connections, functions),
      ...nodes.flatMap((node) => nodeToElements(node, selectedNodeId, functions)),
    ],
  );
}
