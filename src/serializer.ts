import type { PandoraFunction, PandoraNode, PandoraProgram } from "./model";

type JsonScalar = string | number | boolean;

export type PandoraJsonProgram = {
  nome: string;
  entradas: JsonScalar[];
  estado: 0;
  lista: Array<{
    id: number;
    chamada: string;
    estado: 0;
    entradas: JsonScalar[];
    saidas: string[];
    grafo: Array<{
      idx: number;
      tipo: PandoraNode["type"];
      ligacoes: Array<number | string>;
      inputs: JsonScalar[];
      outputs: string[];
    }>;
  }>;
};

function parseValue(value: unknown): JsonScalar {
  if (typeof value !== "string") return typeof value === "number" || typeof value === "boolean" ? value : "";
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const numeric = Number(trimmed);
  return Number.isNaN(numeric) ? value : numeric;
}

function orderedNodes(definition: PandoraFunction): PandoraNode[] {
  return [...definition.nodes].sort((left, right) => {
    const rank = (node: PandoraNode) =>
      node.functionPort === "input" ? 0 : node.functionPort === "output" ? 2 : 1;
    const leftRank = rank(left);
    const rightRank = rank(right);
    if (leftRank !== rightRank) return leftRank - rightRank;
    return (left.functionPortIndex ?? 0) - (right.functionPortIndex ?? 0);
  });
}

function serializeFunction(
  definition: PandoraFunction,
  functionIndex: number,
  functionsById: Map<string, PandoraFunction>,
): PandoraJsonProgram["lista"][number] {
  const nodes = orderedNodes(definition);
  const inputNodes = nodes.filter((node) => node.type === "lig" && node.functionPort === "input");
  const outputNodes = nodes.filter((node) => node.type === "lig" && node.functionPort === "output");
  if (inputNodes.length !== definition.parameters.length) {
    throw new Error(
      `A função ${definition.name} precisa de um lig input para cada parâmetro antes de exportar`,
    );
  }
  const inputIndexes = inputNodes
    .map((node) => node.functionPortIndex ?? 0)
    .sort((left, right) => left - right);
  if (inputIndexes.some((index, position) => index !== position)) {
    throw new Error(`Os lig inputs da função ${definition.name} devem cobrir cada parâmetro uma única vez`);
  }
  if (outputNodes.length !== 1) {
    throw new Error(`A função ${definition.name} precisa de exatamente um lig output antes de exportar`);
  }

  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const connectionsBySource = new Map<string, typeof definition.connections>();
  for (const connection of definition.connections) {
    const sourceConnections = connectionsBySource.get(connection.fromNodeId) ?? [];
    sourceConnections.push(connection);
    connectionsBySource.set(connection.fromNodeId, sourceConnections);
  }

  const graph = nodes.map((node, index) => {
    const outgoing = connectionsBySource.get(node.id) ?? [];
    const destinations = outgoing.map((connection) => {
      const destinationIndex = indexById.get(connection.toNodeId);
      if (destinationIndex === undefined) {
        throw new Error(`Conexão aponta para um nodo inexistente na função ${definition.name}`);
      }
      return destinationIndex;
    });
    const links: Array<number | string> =
      node.type === "encp"
        ? [
            ...(node.functionId
              ? [functionsById.get(node.functionId)?.name ?? (() => {
                  throw new Error(`Função chamada não encontrada pelo nodo ${node.id}`);
                })()]
              : (() => {
                  throw new Error(`Nodo encp ${node.id} não possui função selecionada`);
                })()),
            ...destinations,
          ]
        : node.functionPort === "output"
          ? ["output"]
          : destinations;
    const inputCount =
      node.type === "encp"
        ? functionsById.get(node.functionId ?? "")?.parameters.length ?? 0
        : node.type === "lig"
          ? 1
          : node.type === "const"
            ? 0
            : node.type === "disor"
              ? 1
              : node.type === "visor"
                ? 2
                : 2;
    return {
      idx: index,
      tipo: node.type,
      ligacoes: links,
      inputs: node.type === "const" ? [parseValue(node.value)] : Array.from({ length: inputCount }, () => ""),
      outputs: [""],
    };
  });

  return {
    id: functionIndex,
    chamada: definition.name,
    estado: 0,
    entradas: definition.parameters.map(() => ""),
    saidas: [""],
    grafo: graph,
  };
}

export function programToPandoraJson(program: PandoraProgram): PandoraJsonProgram {
  const entryFunction = program.functions.find((item) => item.id === program.entryFunctionId);
  if (!entryFunction) throw new Error("O programa não possui uma função de entrada válida");
  const functionsById = new Map(program.functions.map((item) => [item.id, item]));
  const auxiliaryFunctions = program.functions.filter((item) => item.id !== entryFunction.id);
  const orderedFunctions = [...auxiliaryFunctions, entryFunction];
  return {
    nome: program.name.trim() || "pandora-programa",
    entradas: entryFunction.parameters.map((_, index) => parseValue(program.parameterValues[index] ?? "")),
    estado: 0,
    lista: orderedFunctions.map((definition, index) =>
      serializeFunction(definition, index, functionsById),
    ),
  };
}
