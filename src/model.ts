export type PandoraNodeType =
  | "lig"
  | "const"
  | "soma"
  | "subs"
  | "mult"
  | "divs"
  | "resto"
  | "igual"
  | "ngual"
  | "meno"
  | "maio"
  | "encp"
  | "disor"
  | "visor"
  | "funcao"
  | "func"
  | "apply"
  | "list"
  | "cons"
  | "head"
  | "tail"
  | "is-empty";

export type PandoraValue =
  | string
  | number
  | boolean
  | { kind: "list"; elements: PandoraValue[] };

export type PandoraNode = {
  id: string;
  type: PandoraNodeType;
  x: number;
  y: number;
  idx?: number;
  value?: PandoraValue;
  functionName?: string;
  functionId?: string;
  functionPort?: "input" | "output";
  functionPortIndex?: number;
  derivedFrom?: string;
  arity?: number;
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
  "resto",
  "igual",
  "ngual",
  "meno",
  "maio",
  "encp",
  "disor",
];

export const nodeVisuals: Record<
  PandoraNodeType,
  {
    label: string;
    iconClass: string;
    shape: "ellipse" | "rectangle" | "diamond";
    color: string;
  }
> = {
  lig: { label: "lig", iconClass: "fa-solid fa-link", shape: "ellipse", color: "#fff3a3" },
  const: { label: "const", iconClass: "fa-solid fa-c", shape: "ellipse", color: "#ffd6e7" },
  soma: { label: "soma", iconClass: "fa-solid fa-plus", shape: "rectangle", color: "#c9e7ff" },
  subs: { label: "subtração", iconClass: "fa-solid fa-minus", shape: "rectangle", color: "#c9e7ff" },
  mult: { label: "multiplicação", iconClass: "fa-solid fa-xmark", shape: "rectangle", color: "#c9e7ff" },
  divs: { label: "divisão", iconClass: "fa-solid fa-divide", shape: "rectangle", color: "#c9e7ff" },
  resto: { label: "resto", iconClass: "fa-solid fa-percent", shape: "rectangle", color: "#c9e7ff" },
  igual: { label: "igual", iconClass: "fa-solid fa-equals", shape: "rectangle", color: "#d4f5d0" },
  ngual: { label: "diferente", iconClass: "fa-solid fa-not-equal", shape: "rectangle", color: "#d4f5d0" },
  meno: { label: "menor", iconClass: "fa-solid fa-less-than", shape: "rectangle", color: "#d4f5d0" },
  maio: { label: "maior", iconClass: "fa-solid fa-greater-than", shape: "rectangle", color: "#d4f5d0" },
  encp: { label: "chamada", iconClass: "fa-solid fa-function", shape: "rectangle", color: "#e4d4ff" },
  disor: { label: "desvio", iconClass: "fa-solid fa-code-fork", shape: "diamond", color: "#ffd4c7" },
  visor: { label: "fim do desvio", iconClass: "fa-solid fa-code-merge", shape: "diamond", color: "#ffd4c7" },
  funcao: { label: "função", iconClass: "fa-solid fa-square-root-variable", shape: "rectangle", color: "#e4d4ff" },
  func: { label: "função", iconClass: "fa-solid fa-lambda", shape: "ellipse", color: "#e4d4ff" },
  apply: { label: "aplicação", iconClass: "fa-solid fa-arrow-up-right-from-square", shape: "rectangle", color: "#e4d4ff" },
  list: { label: "lista", iconClass: "fa-solid fa-list", shape: "ellipse", color: "#fcbbbb" },
  cons: { label: "construtor", iconClass: "fa-solid fa-circle-plus", shape: "ellipse", color: "#fcbbbb" },
  head: { label: "primeiro", iconClass: "fa-solid fa-backward-step", shape: "ellipse", color: "#fcbbbb" },
  tail: { label: "restante", iconClass: "fa-solid fa-forward-step", shape: "ellipse", color: "#fcbbbb" },
  "is-empty": { label: "lista vazia", iconClass: "fa-brands fa-creative-commons-zero", shape: "ellipse", color: "#fcbbbb" },
};

export function inputPortCount(
  type: PandoraNodeType,
  functionArity = 0,
  nodeArity = 2,
): number {
  if (["soma", "subs", "mult", "divs", "resto", "igual", "ngual", "meno", "maio"].includes(type)) return 2;
  if (type === "disor") return 1;
  if (type === "visor") return 2;
  if (type === "encp") return functionArity;
  if (type === "func" || type === "list") return 0;
  if (type === "apply") return nodeArity;
  if (type === "cons") return 2;
  if (["head", "tail", "is-empty"].includes(type)) return 1;
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
