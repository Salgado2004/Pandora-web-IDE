export type PandoraNodeType =
  | "lig"
  | "const"
  | "soma"
  | "subs"
  | "mult"
  | "divs"
  | "igual"
  | "ngual"
  | "meno"
  | "maio"
  | "encp"
  | "disor"
  | "visor"
  | "funcao";

export type PandoraNode = {
  id: string;
  type: PandoraNodeType;
  x: number;
  y: number;
  idx?: number;
  value?: string | number | boolean;
  functionName?: string;
  functionId?: string;
  functionPort?: "input" | "output";
  functionPortIndex?: number;
  derivedFrom?: string;
};

export type PandoraConnection = {
  id: string;
  fromNodeId: string;
  fromPort: number;
  toNodeId: string;
  toPort: number;
};

export type PandoraFunction = {
  id: string;
  name: string;
  parameters: PandoraParameter[];
  nodes: PandoraNode[];
  connections: PandoraConnection[];
};

export type PandoraParameter = {
  name: string;
};

export type PandoraProgram = {
  name: string;
  nodes: PandoraNode[];
  connections: PandoraConnection[];
  functions: PandoraFunction[];
  entryFunctionId: string;
  parameterValues: string[];
};

export const editableNodeTypes: PandoraNodeType[] = [
  "lig",
  "const",
  "soma",
  "subs",
  "mult",
  "divs",
  "igual",
  "ngual",
  "meno",
  "maio",
  "encp",
  "disor",
];

export const nodeVisuals: Record<
  PandoraNodeType,
  { label: string; shape: "ellipse" | "rectangle" | "diamond"; color: string }
> = {
  lig: { label: "lig", shape: "ellipse", color: "#fff3a3" },
  const: { label: "C", shape: "ellipse", color: "#ffd6e7" },
  soma: { label: "+", shape: "rectangle", color: "#c9e7ff" },
  subs: { label: "-", shape: "rectangle", color: "#c9e7ff" },
  mult: { label: "*", shape: "rectangle", color: "#c9e7ff" },
  divs: { label: "/", shape: "rectangle", color: "#c9e7ff" },
  igual: { label: "=", shape: "rectangle", color: "#d4f5d0" },
  ngual: { label: "!=", shape: "rectangle", color: "#d4f5d0" },
  meno: { label: "<", shape: "rectangle", color: "#d4f5d0" },
  maio: { label: ">", shape: "rectangle", color: "#d4f5d0" },
  encp: { label: "ƒ", shape: "rectangle", color: "#e4d4ff" },
  disor: { label: "se", shape: "diamond", color: "#ffd4c7" },
  visor: { label: "fim-se", shape: "diamond", color: "#ffd4c7" },
  funcao: { label: "função", shape: "rectangle", color: "#e4d4ff" },
};

export function inputPortCount(type: PandoraNodeType, functionArity = 0): number {
  if (["soma", "subs", "mult", "divs", "igual", "ngual", "meno", "maio"].includes(type)) return 2;
  if (type === "disor") return 1;
  if (type === "visor") return 2;
  if (type === "encp") return functionArity;
  if (type === "lig") return 1;
  return 0;
}

export function outputPortCount(type: PandoraNodeType): number {
  if (type === "funcao") return 1;
  return type === "disor" ? 2 : type === "lig" || type === "const" ? 1 : 1;
}

export const initialProgram: PandoraProgram = {
  name: "pandora-programa",
  nodes: [
    {
      id: "main-node",
      type: "funcao",
      functionId: "main",
      functionName: "main",
      x: 100,
      y: 220,
    },
  ],
  connections: [],
  functions: [
    {
      id: "main",
      name: "main",
      parameters: [],
      nodes: [],
      connections: [],
    },
  ],
  entryFunctionId: "main",
  parameterValues: [],
};
