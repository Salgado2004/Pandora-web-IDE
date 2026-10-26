import type {
  PandoraConnection,
  PandoraFunction,
  PandoraNode,
  PandoraNodeType,
  PandoraProgram,
} from "./model";

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

type JsonNode = {
  idx?: number;
  tipo?: string;
  type?: string;
  ligacoes?: Array<number | string>;
  inputs?: JsonScalar[];
  entradas?: JsonScalar[];
};

type JsonFunction = {
  id?: number;
  chamada?: string;
  nome?: string;
  entradas?: JsonScalar[];
  grafo?: JsonNode[];
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

function isNodeType(value: string): value is PandoraNodeType {
  return [
    "lig", "const", "soma", "subs", "mult", "divs", "igual", "ngual",
    "meno", "maio", "encp", "disor", "visor",
  ].includes(value);
}

function importNodePosition(index: number, total: number): { x: number; y: number } {
  const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
  return {
    x: 120 + (index % columns) * 170,
    y: 80 + Math.floor(index / columns) * 130,
  };
}

export function pandoraJsonToProgram(data: unknown): PandoraProgram {
  if (!data || typeof data !== "object") {
    throw new Error("O arquivo Pandora deve conter um objeto JSON");
  }
  const raw = data as { nome?: unknown; entradas?: unknown; lista?: unknown };
  if (!Array.isArray(raw.lista) || raw.lista.length === 0) {
    throw new Error("O arquivo Pandora não possui funções");
  }
  const rawFunctions = raw.lista as JsonFunction[];
  const names = rawFunctions.map((item, index) => {
    const name = item.chamada ?? item.nome;
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error(`A função ${index + 1} não possui nome`);
    }
    return name;
  });
  if (new Set(names).size !== names.length) {
    throw new Error("O arquivo Pandora possui funções com nomes duplicados");
  }
  const functionIds = rawFunctions.map((item, index) => `function-${item.id ?? index}`);
  const functionIdByName = new Map(names.map((name, index) => [name, functionIds[index]]));

  const functions = rawFunctions.map((definition, functionIndex) => {
    if (!Array.isArray(definition.grafo)) {
      throw new Error(`A função ${names[functionIndex]} não possui um grafo válido`);
    }
    const nodes = definition.grafo.map((rawNode, index) => {
      const type = rawNode.tipo ?? rawNode.type;
      if (typeof type !== "string" || !isNodeType(type)) {
        throw new Error(`Nodo ${index} da função ${names[functionIndex]} possui tipo inválido`);
      }
      const position = importNodePosition(index, definition.grafo!.length);
      const links = Array.isArray(rawNode.ligacoes) ? rawNode.ligacoes : [];
      const functionId = type === "encp"
        ? functionIdByName.get(links.find((link) => typeof link === "string") as string)
        : undefined;
      if (type === "encp" && !functionId) {
        throw new Error(`Chamada encp inválida no nodo ${index} da função ${names[functionIndex]}`);
      }
      const inputValues = rawNode.inputs ?? rawNode.entradas ?? [];
      return {
        id: `${functionIds[functionIndex]}-node-${index}`,
        type,
        x: position.x,
        y: position.y,
        idx: rawNode.idx ?? index,
        ...(type === "const" ? { value: inputValues[0] ?? "" } : {}),
        ...(functionId ? {
          functionId,
          functionName: links.find((link) => typeof link === "string"),
        } : {}),
        ...(type === "lig" && index < (definition.entradas?.length ?? 0)
          ? { functionPort: "input" as const, functionPortIndex: index }
          : {}),
        ...(type === "lig" && (links.includes("output") || links.includes("x"))
          ? { functionPort: "output" as const }
          : {}),
      } satisfies PandoraNode;
    });
    const nodesByIndex = new Map(nodes.map((node, index) => [index, node]));
    const incomingPorts = new Map<number, number>();
    const connections: PandoraConnection[] = [];
    definition.grafo.forEach((rawNode, fromIndex) => {
      const fromNode = nodesByIndex.get(fromIndex);
      if (!fromNode) return;
      const links = Array.isArray(rawNode.ligacoes) ? rawNode.ligacoes : [];
      links.forEach((link, linkIndex) => {
        if (typeof link !== "number") return;
        const toNode = nodesByIndex.get(link);
        if (!toNode) {
          throw new Error(`Ligação aponta para um nodo inexistente na função ${names[functionIndex]}`);
        }
        const toPort = incomingPorts.get(link) ?? 0;
        incomingPorts.set(link, toPort + 1);
        connections.push({
          id: `${functionIds[functionIndex]}-connection-${connections.length}`,
          fromNodeId: fromNode.id,
          fromPort: typeOutputPort(fromNode.type, linkIndex),
          toNodeId: toNode.id,
          toPort,
        });
      });
    });
    const parameterCount = definition.entradas?.length ?? 0;
    return {
      id: functionIds[functionIndex],
      name: names[functionIndex],
      parameters: Array.from({ length: parameterCount }, (_, index) => ({ name: `p${index + 1}` })),
      nodes,
      connections,
    };
  });

  const entryIndex = rawFunctions.length - 1;
  const entryFunction = functions[entryIndex];
  const functionNodes = functions.map((definition, index) => ({
    id: `${definition.id}-program-node`,
    type: "funcao" as const,
    functionId: definition.id,
    functionName: definition.name,
    x: 100 + (index % 2) * 520,
    y: 100 + Math.floor(index / 2) * 280,
  }));
  return {
    name: typeof raw.nome === "string" && raw.nome.trim() ? raw.nome : "pandora-programa",
    nodes: functionNodes,
    connections: [],
    functions,
    entryFunctionId: entryFunction.id,
    parameterValues: Array.isArray(raw.entradas)
      ? raw.entradas.map((value) => String(value ?? ""))
      : [],
  };
}

function typeOutputPort(type: PandoraNodeType, linkIndex: number): number {
  return type === "disor" ? linkIndex : 0;
}
