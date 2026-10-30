import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { ExcalidrawImperativeAPI, ExcalidrawProps } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import {
  initialProgram,
  inputPortCount,
  type PandoraConnection,
  type PandoraFunction,
  type PandoraNode,
  type PandoraParameter,
  type PandoraProgram,
} from "./model";
import { CONNECTION_DATA_KIND, NODE_DATA_KIND, nodesToElements } from "./scene";
import { pandoraJsonToProgram, programToPandoraJson } from "./serializer";
import {
  Interpretador,
  normalizarArquivo,
} from "@pandora-lang/interpreter";
import { EditorCanvas } from "./components/EditorCanvas";
import { EditorHeader } from "./components/EditorHeader";
import { ExecutionPanel } from "./components/ExecutionPanel";
import { PropertiesPanel } from "./components/PropertiesPanel";
import "./styles.css";

type EditorContext = "root" | string;

function emptyParameters(arity: number): PandoraParameter[] {
  return Array.from({ length: arity }, (_, index) => ({
    name: `p${index + 1}`,
  }));
}

export default function App() {
  const [program, setProgram] = useState<PandoraProgram>(initialProgram);
  const [context, setContext] = useState<EditorContext>("root");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [isNodeMenuOpen, setIsNodeMenuOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<unknown>(undefined);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isPropertiesMinimized, setIsPropertiesMinimized] = useState(false);
  const [isExecutionMinimized, setIsExecutionMinimized] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const pendingPositionsRef = useRef(
    new Map<string, { x: number; y: number }>(),
  );
  const lastClickRef = useRef<{ nodeId: string; at: number } | null>(null);

  const activeFunction =
    context === "root"
      ? undefined
      : program.functions.find((item) => item.id === context);
  const nodes = activeFunction ? activeFunction.nodes : program.nodes;
  const connections = activeFunction
    ? activeFunction.connections
    : program.connections;
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedFunction =
    context === "root" && selectedNode?.functionId
      ? program.functions.find((item) => item.id === selectedNode.functionId)
      : activeFunction;
  const elements = useMemo(
    () => nodesToElements(
      nodes,
      connections,
      selectedNodeId,
      program.functions,
      context === "root",
    ),
    [nodes, connections, selectedNodeId, program.functions, context],
  );

  useEffect(() => {
    if (!isDraggingRef.current) api?.updateScene({ elements });
    if (!isDraggingRef.current && elements.length === 0) api?.resetScene();
  }, [api, elements]);

  function updateContext(
    updater: (current: PandoraNode[], connections: PandoraConnection[]) => {
      nodes: PandoraNode[];
      connections: PandoraConnection[];
    },
  ) {
    setProgram((current) => {
      if (context === "root") {
        const next = updater(current.nodes, current.connections);
        return { ...current, nodes: next.nodes, connections: next.connections };
      }
      return {
        ...current,
        functions: current.functions.map((item) => {
          if (item.id !== context) return item;
          const next = updater(item.nodes, item.connections);
          return { ...item, nodes: next.nodes, connections: next.connections };
        }),
      };
    });
  }

  function handleChange(
    ...[nextElements]: Parameters<NonNullable<ExcalidrawProps["onChange"]>>
  ) {
    const deletedNodeIds = new Set<string>();
    const deletedConnectionIds = new Set<string>();
    for (const element of nextElements) {
      if (element.customData?.kind === NODE_DATA_KIND) {
        const nodeId = element.customData.nodeId;
        if (typeof nodeId === "string") {
          if (element.customData.preview === true) continue;
          if (element.isDeleted) deletedNodeIds.add(nodeId);
          if (element.customData.role === "shape") {
            pendingPositionsRef.current.set(nodeId, {
              x: element.x,
              y: element.y,
            });
          }
        }
      }
      if (
        element.customData?.kind === CONNECTION_DATA_KIND &&
        element.isDeleted &&
        typeof element.customData.connectionId === "string"
      ) {
        deletedConnectionIds.add(element.customData.connectionId);
      }
    }
    if (deletedNodeIds.size > 0) {
      updateContext((currentNodes, currentConnections) => {
        const removedNodeIds = new Set(deletedNodeIds);
        for (const node of currentNodes) {
          if (node.derivedFrom && removedNodeIds.has(node.derivedFrom)) {
            removedNodeIds.add(node.id);
          }
        }
        return {
          nodes: currentNodes.filter((node) => !removedNodeIds.has(node.id)),
          connections: currentConnections.filter(
            (connection) =>
              !removedNodeIds.has(connection.fromNodeId) &&
              !removedNodeIds.has(connection.toNodeId),
          ),
        };
      });
      setSelectedNodeId(null);
      return;
    }
    if (deletedConnectionIds.size > 0) {
      updateContext((currentNodes, currentConnections) => ({
        nodes: currentNodes,
        connections: currentConnections.filter(
          (connection) => !deletedConnectionIds.has(connection.id),
        ),
      }));
    }
  }

  function commitPendingPositions() {
    const pending = pendingPositionsRef.current;
    if (pending.size === 0) return;
    updateContext((currentNodes, currentConnections) => ({
      nodes: currentNodes.map((node) => {
        const position = pending.get(node.id);
        return position ? { ...node, ...position } : node;
      }),
      connections: currentConnections,
    }));
    pendingPositionsRef.current = new Map();
  }

  function handlePointerDown() {
    isDraggingRef.current = true;
    pendingPositionsRef.current = new Map();
  }

  function handlePointerUp() {
    if (!api) return;
    const selected = api.getAppState().selectedElementIds;
    const firstId = Object.keys(selected)[0];
    const element = api.getSceneElements().find((item) => item.id === firstId);
    const nodeId = element?.customData?.nodeId;
    const node = nodes.find((item) => item.id === nodeId);
    setSelectedNodeId(
      typeof nodeId === "string" && (!node?.derivedFrom || node.type === "visor")
        ? nodeId
        : null,
    );
    if (context !== "root" && typeof nodeId === "string" && node?.type === "funcao") {
      const now = Date.now();
      const previous = lastClickRef.current;
      if (previous?.nodeId === nodeId && now - previous.at < 350) {
        const functionId = node.functionId;
        if (functionId) {
          setContext(functionId);
          setSelectedNodeId(null);
        }
        lastClickRef.current = null;
      } else {
        lastClickRef.current = { nodeId, at: now };
      }
    } else {
      lastClickRef.current = null;
    }
    window.setTimeout(() => {
      commitPendingPositions();
      isDraggingRef.current = false;
      setProgram((current) => ({ ...current }));
    }, 100);
  }

  function updateFunction(updater: (item: PandoraFunction) => PandoraFunction) {
    if (!selectedFunction) return;
    const nextFunction = updater(selectedFunction);
    setProgram((current) => ({
      ...current,
      functions: current.functions.map((item) => {
        const nextItem = item.id === selectedFunction.id ? nextFunction : item;
        return {
          ...nextItem,
          nodes: nextItem.nodes.map((node) =>
            node.type === "encp" && node.functionId === selectedFunction.id
              ? { ...node, functionName: nextFunction.name }
              : node.type === "lig" &&
                  node.functionPort === "input" &&
                  nextFunction.parameters.length > 0
                ? {
                    ...node,
                    functionPortIndex: Math.min(
                      node.functionPortIndex ?? 0,
                      nextFunction.parameters.length - 1,
                    ),
                  }
              : node,
          ),
          connections: nextItem.connections.filter(
            (connection) => {
              const target = nextItem.nodes.find(
                (node) => node.id === connection.toNodeId,
              );
              return !(
                target?.type === "encp" &&
                target.functionId === selectedFunction.id
              ) || connection.toPort < nextFunction.parameters.length;
            },
          ),
        };
      }),
      nodes:
        current.nodes.map((node) =>
          node.functionId === selectedFunction.id
            ? { ...node, functionName: nextFunction.name }
            : node,
        ),
      parameterValues:
        selectedFunction.id === current.entryFunctionId
          ? current.parameterValues.slice(0, nextFunction.parameters.length).concat(
              Array.from(
                {
                  length: Math.max(
                    0,
                    nextFunction.parameters.length -
                      current.parameterValues.length,
                  ),
                },
                () => "",
              ),
            )
          : current.parameterValues,
    }));
  }

  function editSelectedFunction() {
    if (context !== "root" || !selectedNode?.functionId) return;
    setContext(selectedNode.functionId);
    setSelectedNodeId(null);
  }

  function addFunction() {
    const id = `function-${Date.now()}`;
    const definition: PandoraFunction = {
      id,
      name: "nova-funcao",
      parameters: emptyParameters(0),
      nodes: [],
      connections: [],
    };
    const appState = api?.getAppState();
    const zoom = appState?.zoom.value ?? 1;
    const x = appState ? (appState.width / 2 - appState.scrollX) / zoom - 39 : 440;
    const y = appState ? (appState.height / 2 - appState.scrollY) / zoom - 34 : 220;
    setProgram((current) => ({
      ...current,
      functions: [...current.functions, definition],
      nodes: [
        ...current.nodes,
        { id: `${id}-node`, type: "funcao", functionId: id, functionName: definition.name, x, y },
      ],
    }));
    setSelectedNodeId(`${id}-node`);
    setIsNodeMenuOpen(false);
  }

  function addNode(type: PandoraNode["type"]) {
    const id = `${type}-${Date.now()}`;
    const appState = api?.getAppState();
    const zoom = appState?.zoom.value ?? 1;
    const x = appState ? (appState.width / 2 - appState.scrollX) / zoom - 39 : 440;
    const y = appState ? (appState.height / 2 - appState.scrollY) / zoom - 34 : 220;
    const nextIdx =
      type === "lig"
        ? Math.max(-1, ...nodes.map((node) => node.idx ?? -1)) + 1
        : undefined;
    const newNode: PandoraNode = {
      id,
      type,
      x,
      y,
      ...(nextIdx === undefined ? {} : { idx: nextIdx }),
      ...(type === "const" ? { value: "" } : {}),
    };
    const newNodes = [newNode];
    if (type === "disor") {
      newNodes.push({
        id: `${id}-visor`,
        type: "visor",
        x: x + 220,
        y,
        derivedFrom: id,
      });
    }
    updateContext((currentNodes, currentConnections) => ({
      nodes: [...currentNodes, ...newNodes],
      connections: currentConnections,
    }));
    setSelectedNodeId(id);
    setIsNodeMenuOpen(false);
  }

  function getInputPortCount(node: PandoraNode) {
    if (node.type === "lig" && node.functionPort === "input") return 0;
    if (node.type === "lig" && node.functionPort === "output") return 1;
    if (node.type !== "encp") return inputPortCount(node.type);
    return (
      program.functions.find((item) => item.id === node.functionId)?.parameters.length ?? 0
    );
  }

  function getOutputPortCount(node: PandoraNode) {
    if (node.type === "disor") return 2;
    return node.type === "lig" && node.functionPort === "output" ? 0 : 1;
  }

  function addConnection(targetValue: string, sourcePort = 0) {
    if (!selectedNodeId || !targetValue) return;
    const isBranchConnection = selectedNode?.type === "disor";
    const separatorIndex = targetValue.lastIndexOf(":");
    const toNodeId = isBranchConnection
      ? targetValue
      : targetValue.slice(0, separatorIndex);
    const toPort = isBranchConnection
      ? 0
      : Number(targetValue.slice(separatorIndex + 1));
    const destination = nodes.find((node) => node.id === toNodeId);
    if (
      !selectedNode ||
      getOutputPortCount(selectedNode) === 0 ||
      !destination ||
      (!isBranchConnection &&
        (!Number.isInteger(toPort) ||
          toPort < 0 ||
          toPort >= getInputPortCount(destination) ||
          connections.some(
            (connection) =>
              connection.toNodeId === toNodeId && connection.toPort === toPort,
          )))
    ) {
      return;
    }
    updateContext((currentNodes, currentConnections) => ({
      nodes: currentNodes,
      connections: [
        ...currentConnections.filter(
          (connection) =>
            !isBranchConnection ||
            connection.fromNodeId !== selectedNodeId ||
            connection.fromPort !== sourcePort,
        ),
        {
          id: `${selectedNodeId}-to-${toNodeId}-${Date.now()}`,
          fromNodeId: selectedNodeId,
          fromPort: sourcePort,
          toNodeId,
          toPort,
        },
      ],
    }));
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    updateContext((currentNodes, currentConnections) => ({
      nodes: currentNodes.filter(
        (node) => node.id !== selectedNodeId && node.derivedFrom !== selectedNodeId,
      ),
      connections: currentConnections.filter(
        (connection) =>
          connection.fromNodeId !== selectedNodeId &&
          connection.toNodeId !== selectedNodeId,
      ),
    }));
    if (context === "root") {
      const functionId = selectedNode?.functionId;
      if (functionId) {
        setProgram((current) => ({
          ...current,
          functions: current.functions.filter((item) => item.id !== functionId),
          entryFunctionId:
            current.entryFunctionId === functionId
              ? current.functions.find((item) => item.id !== functionId)?.id ?? ""
              : current.entryFunctionId,
        }));
      }

    }
    setSelectedNodeId(null);
  }

  function deleteSelectedFunction() {
    if (context !== "root" || !selectedFunction) return;
    const deletedId = selectedFunction.id;
    setProgram((current) => {
      const remainingFunctions = current.functions.filter((item) => item.id !== deletedId);
      const nextEntryId =
        current.entryFunctionId === deletedId
          ? remainingFunctions[0]?.id ?? ""
          : current.entryFunctionId;
      const clearCall = (node: PandoraNode): PandoraNode =>
        node.type === "encp" && node.functionId === deletedId
          ? { ...node, functionId: undefined, functionName: undefined }
          : node;
      return {
        ...current,
        functions: remainingFunctions.map((item) => ({
          ...item,
          nodes: item.nodes.map(clearCall),
        })),
        nodes: current.nodes.filter((node) => node.functionId !== deletedId),
        connections: current.connections.filter((connection) => {
          const removedNodeIds = new Set(
            current.nodes
              .filter((node) => node.functionId === deletedId)
              .map((node) => node.id),
          );
          return (
            !removedNodeIds.has(connection.fromNodeId) &&
            !removedNodeIds.has(connection.toNodeId)
          );
        }),
        entryFunctionId: nextEntryId,
        parameterValues:
          nextEntryId === current.entryFunctionId ? current.parameterValues : [],
      };
    });
    setSelectedNodeId(null);
  }

  function exportProgram() {
    try {
      const json = programToPandoraJson(program);
      const blob = new Blob([JSON.stringify(json, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${json.nome.replace(/[<>:"/\\|?*]+/g, "-")}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportError(null);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Não foi possível exportar o programa",
      );
    }

  }

  async function importProgram(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const importedProgram = pandoraJsonToProgram(JSON.parse(await file.text()));
      setProgram(importedProgram);
      setContext("root");
      setSelectedNodeId(null);
      setExecutionResult(undefined);
      setExecutionError(null);
      setExportError(null);
    } catch (error) {
      setExportError(
        error instanceof Error
          ? `Não foi possível importar: ${error.message}`
          : "Não foi possível importar o programa",
      );
    }
  }

  function runProgram() {
    try {
      const json = programToPandoraJson(program);
      const arquivo = normalizarArquivo(json);
      const programaExecutado = Interpretador(arquivo);
      setExecutionResult(programaExecutado.resultado);
      setExecutionError(null);
      setExportError(null);
    } catch (error) {
      setExecutionResult(undefined);
      setExecutionError(
        error instanceof Error ? error.message : "Não foi possível executar o programa",
      );
    }
  }

  function formatExecutionValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  }

  const entryFunction =
    program.functions.find((item) => item.id === program.entryFunctionId) ??
    program.functions[0];
  return (
    <main className="app-shell">
      <EditorHeader
        activeFunctionName={activeFunction?.name}
        context={context}
        isNodeMenuOpen={isNodeMenuOpen}
        onGoToRoot={() => {
          setContext("root");
          setSelectedNodeId(null);
        }}
        onToggleMenu={() => setIsNodeMenuOpen((open) => !open)}
        onAddFunction={addFunction}
        onAddNode={addNode}
      />
      <section className="editor-layout">
        <EditorCanvas
          context={context}
          elements={elements}
          onApi={setApi}
          onChange={handleChange}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        />

        <PropertiesPanel
          context={context}
          program={program}
          setProgram={setProgram}
          activeFunction={activeFunction}
          selectedNode={selectedNode}
          selectedFunction={selectedFunction}
          selectedNodeId={selectedNodeId}
          nodes={nodes}
          connections={connections}
          isMinimized={isPropertiesMinimized}
          onToggle={() => setIsPropertiesMinimized((minimized) => !minimized)}
          updateContext={updateContext}
          updateFunction={updateFunction}
          onEditFunction={editSelectedFunction}
          onDeleteNode={deleteSelectedNode}
          onDeleteFunction={deleteSelectedFunction}
          getInputPortCount={getInputPortCount}
          addConnection={addConnection}
          importInputRef={importInputRef}
          exportError={exportError}
          onExport={exportProgram}
          onImport={importProgram}
        />
      </section>
      <ExecutionPanel
        entryFunction={entryFunction}
        program={program}
        setProgram={setProgram}
        isMinimized={isExecutionMinimized}
        onToggle={() => setIsExecutionMinimized((minimized) => !minimized)}
        onRun={runProgram}
        executionResult={executionResult}
        executionError={executionError}
        formatValue={formatExecutionValue}
      />
    </main>
  );
}
