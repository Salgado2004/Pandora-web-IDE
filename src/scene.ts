import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { PandoraConnection, PandoraFunction, PandoraNode } from "./model";
import { inputPortCount, nodeVisuals, outputPortCount } from "./model";

export const NODE_DATA_KIND = "pandora-node";
export const CONNECTION_DATA_KIND = "pandora-connection";
const NODE_WIDTH = 78;
const NODE_HEIGHT = 68;
const PORT_SIZE = 10;
const FUNCTION_PREVIEW_WIDTH = 430;
const FUNCTION_PREVIEW_HEIGHT = 190;
const FUNCTION_PREVIEW_SCALE = 0.45;
const FUNCTION_PREVIEW_NODE_WIDTH = NODE_WIDTH * FUNCTION_PREVIEW_SCALE;
const FUNCTION_PREVIEW_NODE_HEIGHT = NODE_HEIGHT * FUNCTION_PREVIEW_SCALE;
const operationTypes = new Set([
    "soma",
    "subs",
    "mult",
    "divs",
    "igual",
    "ngual",
    "meno",
    "maio",
  ]);

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
  const fontSize = operationTypes.has(node.type)
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

  function expandedFunctionToElements(
    node: PandoraNode,
    selectedNodeId: string | null,
    functions: PandoraFunction[],
  ): ExcalidrawElementSkeleton[] {
    const definition = functions.find((item) => item.id === node.functionId);
    if (!definition) return nodeToElements(node, selectedNodeId, functions);

    const innerNodes = definition.nodes.filter((item) => !item.derivedFrom);
    const minX = Math.min(...innerNodes.map((item) => item.x), 0);
    const minY = Math.min(...innerNodes.map((item) => item.y), 0);
    const maxX = Math.max(...innerNodes.map((item) => item.x), 0);
    const maxY = Math.max(...innerNodes.map((item) => item.y), 0);
    const scale = Math.min(
      1,
      (FUNCTION_PREVIEW_WIDTH - 60) / Math.max(maxX - minX + NODE_WIDTH, NODE_WIDTH),
      (FUNCTION_PREVIEW_HEIGHT - 30) / Math.max(maxY - minY + NODE_HEIGHT, NODE_HEIGHT),
    );
    const previewNodes = innerNodes.map((item) => ({
      ...item,
      id: `${node.id}::${item.id}`,
      x: node.x + 100 + (item.x - minX) * scale,
      y: node.y + 15 + (item.y - minY) * scale,
      derivedFrom: node.id,
    }));
    const nodeIds = new Map(innerNodes.map((item, index) => [item.id, previewNodes[index].id]));
    const previewConnections = definition.connections.flatMap((connection) => {
      const fromNodeId = nodeIds.get(connection.fromNodeId);
      const toNodeId = nodeIds.get(connection.toNodeId);
      if (!fromNodeId || !toNodeId) return [];
      return [{
        ...connection,
        id: `${node.id}::${connection.id}`,
        fromNodeId,
        toNodeId,
      }];
    });
    const previewEdges = connectionsToElements(previewNodes, previewConnections, functions);
    const previewElements = previewNodes.flatMap((item) =>
      nodeToElements(item, null, functions),
    );
    const inputCount = definition.parameters.length;
    const outputY = node.y + FUNCTION_PREVIEW_HEIGHT / 2 - PORT_SIZE / 2;
    const inputPorts = Array.from({ length: inputCount }, (_, index) => ({
      type: "ellipse",
      id: `${node.id}-preview-input-${index}`,
      x: node.x - PORT_SIZE / 2,
      y: portY(index, inputCount, node.y + 35),
      width: PORT_SIZE,
      height: PORT_SIZE,
      backgroundColor: "#77738a",
      strokeColor: "#34324a",
      customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "port" },
      groupIds: [node.id],
      locked: true,
    } satisfies ExcalidrawElementSkeleton));
    const outer = {
      type: "rectangle",
      id: `${node.id}-preview`,
      x: node.x,
      y: node.y,
      width: FUNCTION_PREVIEW_WIDTH,
      height: FUNCTION_PREVIEW_HEIGHT,
      backgroundColor: "#ffffff",
      strokeColor: "#9b7bb2",
      strokeWidth: 2,
      roundness: { type: 3 },
      customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "shape" },
      groupIds: [node.id],
      locked: true,
    } satisfies ExcalidrawElementSkeleton;
    const title = {
      type: "rectangle",
      id: `${node.id}-preview-title`,
      x: node.x + 10,
      y: node.y + 15,
      width: 68,
      height: FUNCTION_PREVIEW_HEIGHT - 30,
      backgroundColor: "#9b6aae",
      strokeColor: "#70487f",
      strokeWidth: 1,
      customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "text" },
      groupIds: [node.id],
      locked: true,
    } satisfies ExcalidrawElementSkeleton;
    const titleText = {
      type: "text",
      id: `${node.id}-preview-label`,
      x: node.x + 10,
      y: node.y + FUNCTION_PREVIEW_HEIGHT / 2 - 12,
      text: definition.name,
      fontSize: 16,
      fontFamily: 2,
      textAlign: "center",
      verticalAlign: "middle",
      width: 68,
      height: 24,
      customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "text" },
      groupIds: [node.id],
      locked: true,
    } satisfies ExcalidrawElementSkeleton;
    const outputPort = {
      type: "ellipse",
      id: `${node.id}-preview-output`,
      x: node.x + FUNCTION_PREVIEW_WIDTH - PORT_SIZE / 2,
      y: outputY,
      width: PORT_SIZE,
      height: PORT_SIZE,
      backgroundColor: "#77738a",
      strokeColor: "#34324a",
      customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "port" },
      groupIds: [node.id],
      locked: true,
    } satisfies ExcalidrawElementSkeleton;
    const interactionLayer = {
      type: "rectangle",
      id: `${node.id}-preview-interaction`,
      x: node.x,
      y: node.y,
      width: FUNCTION_PREVIEW_WIDTH,
      height: FUNCTION_PREVIEW_HEIGHT,
      backgroundColor: "#ffffff",
      strokeColor: "transparent",
      strokeWidth: 0,
      opacity: 0.01,
      customData: {
        kind: NODE_DATA_KIND,
        nodeId: node.id,
        nodeType: "funcao",
        role: "interaction",
        preview: true,
      },
      groupIds: [node.id],
      locked: false,
    } satisfies ExcalidrawElementSkeleton;
    return [
      outer,
      title,
      titleText,
      ...inputPorts,
      outputPort,
      ...previewEdges,
      ...previewElements,
    ];
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

function expandedFunctionToElements(
  node: PandoraNode,
  selectedNodeId: string | null,
  functions: PandoraFunction[],
): ExcalidrawElementSkeleton[] {
  const definition = functions.find((item) => item.id === node.functionId);
  if (!definition) return nodeToElements(node, selectedNodeId, functions);
  const innerNodes = definition.nodes.filter((item) => !item.derivedFrom);
  const minX = Math.min(...innerNodes.map((item) => item.x), 0);
  const minY = Math.min(...innerNodes.map((item) => item.y), 0);
  const maxX = Math.max(...innerNodes.map((item) => item.x), 0);
  const maxY = Math.max(...innerNodes.map((item) => item.y), 0);
  const scale = Math.min(
    1,
    (FUNCTION_PREVIEW_WIDTH - 130) / Math.max(maxX - minX + NODE_WIDTH, NODE_WIDTH),
    (FUNCTION_PREVIEW_HEIGHT - 30) / Math.max(maxY - minY + NODE_HEIGHT, NODE_HEIGHT),
  );
  const previewNodes = innerNodes.map((item) => ({
    ...item,
    id: `${node.id}::${item.id}`,
    x: node.x + 100 + (item.x - minX) * scale,
    y: node.y + 15 + (item.y - minY) * scale,
    derivedFrom: node.id,
  }));
  const nodeIds = new Map(innerNodes.map((item, index) => [item.id, previewNodes[index].id]));
  const previewConnections = definition.connections.flatMap((connection) => {
    const fromNodeId = nodeIds.get(connection.fromNodeId);
    const toNodeId = nodeIds.get(connection.toNodeId);
    return fromNodeId && toNodeId
      ? [{ ...connection, id: `${node.id}::${connection.id}`, fromNodeId, toNodeId }]
      : [];
  });
  const inputCount = definition.parameters.length;
  const groupIds = [node.id];
  const outer = {
    type: "rectangle",
    id: `${node.id}-preview`,
    x: node.x,
    y: node.y,
    width: FUNCTION_PREVIEW_WIDTH,
    height: FUNCTION_PREVIEW_HEIGHT,
    backgroundColor: "#ffffff",
    strokeColor: "#9b7bb2",
    strokeWidth: 2,
    roundness: { type: 3 },
    customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "shape" },
    groupIds,
    locked: true,
  } satisfies ExcalidrawElementSkeleton;
  const title = {
    type: "rectangle",
    id: `${node.id}-preview-title`,
    x: node.x + 10,
    y: node.y + 15,
    width: 68,
    height: FUNCTION_PREVIEW_HEIGHT - 30,
    backgroundColor: "#9b6aae",
    strokeColor: "#70487f",
    customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "text" },
    groupIds,
    locked: true,
  } satisfies ExcalidrawElementSkeleton;
  const titleText = {
    type: "text",
    id: `${node.id}-preview-label`,
    x: node.x + 10,
    y: node.y + FUNCTION_PREVIEW_HEIGHT / 2 - 12,
    text: definition.name,
    fontSize: 16,
    fontFamily: 2,
    textAlign: "center",
    verticalAlign: "middle",
    width: 68,
    height: 24,
    customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "text" },
    groupIds,
    locked: true,
  } satisfies ExcalidrawElementSkeleton;
  const inputPorts = Array.from({ length: inputCount }, (_, index) => ({
    type: "ellipse",
    id: `${node.id}-preview-input-${index}`,
    x: node.x - PORT_SIZE / 2,
    y: portY(index, inputCount, node.y + 35),
    width: PORT_SIZE,
    height: PORT_SIZE,
    backgroundColor: "#77738a",
    strokeColor: "#34324a",
    customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "port" },
    groupIds,
    locked: true,
  } satisfies ExcalidrawElementSkeleton));
  const outputPort = {
    type: "ellipse",
    id: `${node.id}-preview-output`,
    x: node.x + FUNCTION_PREVIEW_WIDTH - PORT_SIZE / 2,
    y: node.y + FUNCTION_PREVIEW_HEIGHT / 2 - PORT_SIZE / 2,
    width: PORT_SIZE,
    height: PORT_SIZE,
    backgroundColor: "#77738a",
    strokeColor: "#34324a",
    customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "port" },
    groupIds,
    locked: true,
  } satisfies ExcalidrawElementSkeleton;
  const interactionLayer = {
    type: "rectangle",
    id: `${node.id}-preview-interaction`,
    x: node.x,
    y: node.y,
    width: FUNCTION_PREVIEW_WIDTH,
    height: FUNCTION_PREVIEW_HEIGHT,
    backgroundColor: "#ffffff",
    strokeColor: "transparent",
    strokeWidth: 0,
    opacity: 0.01,
    customData: {
      kind: NODE_DATA_KIND,
      nodeId: node.id,
      nodeType: "funcao",
      role: "interaction",
      preview: true,
    },
    groupIds,
    locked: false,
  } satisfies ExcalidrawElementSkeleton;
  return [
    outer,
    title,
    titleText,
    ...inputPorts,
    outputPort,
    ...connectionsToElements(previewNodes, previewConnections, functions)
      .map((element) => ({ ...element, groupIds, locked: true })),
    ...previewNodes
      .flatMap((item) => nodeToElements(item, null, functions))
      .map((element) => ({ ...element, groupIds, locked: true })),
    interactionLayer,
  ];
}

function compactExpandedFunctionToElements(
  node: PandoraNode,
  selectedNodeId: string | null,
  functions: PandoraFunction[],
): ExcalidrawElementSkeleton[] {
  const definition = functions.find((item) => item.id === node.functionId);
  if (!definition) return nodeToElements(node, selectedNodeId, functions);

  const innerNodes = definition.nodes.filter((item) => !item.derivedFrom);
  const minX = Math.min(...innerNodes.map((item) => item.x), 0);
  const minY = Math.min(...innerNodes.map((item) => item.y), 0);
  const maxX = Math.max(...innerNodes.map((item) => item.x), 0);
  const maxY = Math.max(...innerNodes.map((item) => item.y), 0);
  const contentWidth = Math.max(
    FUNCTION_PREVIEW_NODE_WIDTH,
    (maxX - minX) * FUNCTION_PREVIEW_SCALE + FUNCTION_PREVIEW_NODE_WIDTH,
  );
  const contentHeight = Math.max(
    FUNCTION_PREVIEW_NODE_HEIGHT,
    (maxY - minY) * FUNCTION_PREVIEW_SCALE + FUNCTION_PREVIEW_NODE_HEIGHT,
  );
  const width = Math.max(FUNCTION_PREVIEW_WIDTH, contentWidth + 120);
  const height = Math.max(FUNCTION_PREVIEW_HEIGHT, contentHeight + 30);
  const contentX = node.x + 25;
  const contentY = node.y + 5;
  const previewNodes = innerNodes.map((item) => ({
    ...item,
    id: `${node.id}::${item.id}`,
    x: contentX + (item.x - minX) * FUNCTION_PREVIEW_SCALE,
    y: contentY + (item.y - minY) * FUNCTION_PREVIEW_SCALE,
    derivedFrom: node.id,
  }));
  const nodeIds = new Map(innerNodes.map((item, index) => [item.id, previewNodes[index].id]));
  const byId = new Map(previewNodes.map((item) => [item.id, item]));
  const previewNodesWithText = new Set(["const", "encp", ...operationTypes]);
  const previewElements = previewNodes.flatMap((item) => {
    const visual = nodeVisuals[item.type];
    const showText = previewNodesWithText.has(item.type);
    return [
      {
        type: visual.shape,
        id: `${item.id}-compact-shape`,
        x: item.x,
        y: item.y,
        width: FUNCTION_PREVIEW_NODE_WIDTH,
        height: FUNCTION_PREVIEW_NODE_HEIGHT,
        backgroundColor: visual.color,
        strokeColor: "#34324a",
        strokeWidth: 1,
        customData: {
          kind: NODE_DATA_KIND,
          nodeId: node.id,
          preview: true,
        },
        groupIds: [node.id],
        locked: true,
      },
      ...(showText
        ? [{
            type: "text",
            id: `${item.id}-compact-text`,
            x: item.x + FUNCTION_PREVIEW_NODE_WIDTH / 2,
            y: item.y + FUNCTION_PREVIEW_NODE_HEIGHT / 2,
            text: visual.label,
            fontSize: 18,
            fontFamily: 2,
            textAlign: "center",
            verticalAlign: "middle",
            width: FUNCTION_PREVIEW_NODE_WIDTH,
            height: FUNCTION_PREVIEW_NODE_HEIGHT,
            customData: {
              kind: NODE_DATA_KIND,
              nodeId: node.id,
              preview: true,
            },
            groupIds: [node.id],
            locked: true,
          }]
        : []),
    ] as ExcalidrawElementSkeleton[];
  });
  const previewConnections = definition.connections.flatMap((connection) => {
    const from = nodeIds.get(connection.fromNodeId);
    const to = nodeIds.get(connection.toNodeId);
    const fromNode = from ? byId.get(from) : undefined;
    const toNode = to ? byId.get(to) : undefined;
    if (!fromNode || !toNode) return [];
    const start = {
      x: fromNode.x + FUNCTION_PREVIEW_NODE_WIDTH,
      y: fromNode.y + FUNCTION_PREVIEW_NODE_HEIGHT / 2,
    };
    const end = {
      x: toNode.x,
      y: toNode.y + FUNCTION_PREVIEW_NODE_HEIGHT / 2,
    };
    return [{
      type: "arrow",
      id: `${node.id}::${connection.id}`,
      x: start.x,
      y: start.y,
      points: [[0, 0], [end.x - start.x, end.y - start.y]],
      endArrowhead: "dot",
      strokeColor: "#77738a",
      strokeWidth: 1,
      customData: { kind: NODE_DATA_KIND, nodeId: node.id, preview: true },
      groupIds: [node.id],
      locked: true,
    } satisfies ExcalidrawElementSkeleton];
  });
  const groupIds = [node.id];
  const outer = {
    type: "rectangle",
    id: `${node.id}-preview`,
    x: node.x,
    y: node.y,
    width,
    height,
    backgroundColor: "transparent",
    strokeColor: "#9b7bb2",
    strokeWidth: 2,
    roundness: { type: 3 },
    customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "shape" },
    groupIds,
    locked: true,
  } satisfies ExcalidrawElementSkeleton;
  const title = {
    type: "rectangle",
    id: `${node.id}-preview-title`,
    x: node.x + 10,
    y: node.y + 15,
    width: 68,
    height: height - 30,
    backgroundColor: "#9b6aae",
    strokeColor: "#70487f",
    customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "text" },
    groupIds,
    locked: true,
  } satisfies ExcalidrawElementSkeleton;
  const titleText = {
    type: "text",
    id: `${node.id}-preview-label`,
    x: node.x + 10,
    y: node.y + height / 2 - 12,
    text: definition.name,
    fontSize: 16,
    fontFamily: 2,
    textAlign: "center",
    verticalAlign: "middle",
    width: 68,
    height: 24,
    customData: { kind: NODE_DATA_KIND, nodeId: node.id, role: "text" },
    groupIds,
    locked: true,
  } satisfies ExcalidrawElementSkeleton;
  const interactionLayer = {
    type: "rectangle",
    id: `${node.id}-preview-interaction`,
    x: node.x,
    y: node.y,
    width,
    height,
    backgroundColor: "#ffffff",
    strokeColor: "transparent",
    strokeWidth: 0,
    opacity: 0.01,
    customData: {
      kind: NODE_DATA_KIND,
      nodeId: node.id,
      nodeType: "funcao",
      role: "interaction",
      preview: true,
    },
    groupIds,
    locked: false,
  } satisfies ExcalidrawElementSkeleton;
  return [outer, title, titleText, ...previewConnections, ...previewElements, interactionLayer];
}

export function nodesToElements(
  nodes: PandoraNode[],
  connections: PandoraConnection[],
  selectedNodeId: string | null,
  functions: PandoraFunction[] = [],
  expandedFunctions = false,
) {
  return convertToExcalidrawElements(
    [
      ...connectionsToElements(nodes, connections, functions),
      ...nodes.flatMap((node) =>
        expandedFunctions && node.type === "funcao"
          ? compactExpandedFunctionToElements(node, selectedNodeId, functions)
          : nodeToElements(node, selectedNodeId, functions),
      ),
    ],
  );
}
