import type { PandoraFunction, PandoraNode } from "../model";
import { inputPortCount, outputPortCount } from "../model";

export const NODE_WIDTH = 78;
export const NODE_HEIGHT = 68;
export const PORT_SIZE = 10;
export const FUNCTION_PREVIEW_WIDTH = 430;
export const FUNCTION_PREVIEW_HEIGHT = 190;
export const FUNCTION_PREVIEW_SCALE = 0.45;
export const FUNCTION_PREVIEW_NODE_WIDTH = NODE_WIDTH * FUNCTION_PREVIEW_SCALE;
export const FUNCTION_PREVIEW_NODE_HEIGHT = NODE_HEIGHT * FUNCTION_PREVIEW_SCALE;

export const operationTypes = new Set([
  "soma",
  "subs",
  "mult",
  "divs",
  "igual",
  "ngual",
  "meno",
  "maio",
]);

export function portY(index: number, count: number, y: number): number {
  return y + ((index + 1) * NODE_HEIGHT) / (count + 1) - PORT_SIZE / 2;
}

export function nodeOutputPortCount(node: PandoraNode): number {
  if (node.type === "lig" && node.functionPort === "output") return 0;
  return outputPortCount(node.type);
}

export function nodeInputPortCount(
  node: PandoraNode,
  functions: PandoraFunction[],
): number {
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
