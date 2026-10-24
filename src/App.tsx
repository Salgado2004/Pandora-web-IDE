import { useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import {
  editableNodeTypes,
  initialProgram,
  inputPortCount,
  nodeVisuals,
  type PandoraConnection,
  type PandoraFunction,
  type PandoraNode,
  type PandoraParameter,
  type PandoraProgram,
} from "./model";
import { CONNECTION_DATA_KIND, NODE_DATA_KIND, nodesToElements } from "./scene";
import { programToPandoraJson } from "./serializer";
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
    () => nodesToElements(nodes, connections, selectedNodeId, program.functions),
    [nodes, connections, selectedNodeId, program.functions],
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
      typeof nodeId === "string" && !node?.derivedFrom ? nodeId : null,
    );
    if (typeof nodeId === "string" && node?.type === "funcao") {
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
    return node.type === "lig" && node.functionPort === "output" ? 0 : 1;
  }

  function addConnection(targetValue: string) {
    if (!selectedNodeId || !targetValue) return;
    const separatorIndex = targetValue.lastIndexOf(":");
    const toNodeId = targetValue.slice(0, separatorIndex);
    const toPort = Number(targetValue.slice(separatorIndex + 1));
    const destination = nodes.find((node) => node.id === toNodeId);
    if (
      !selectedNode ||
      getOutputPortCount(selectedNode) === 0 ||
      !destination ||
      !Number.isInteger(toPort) ||
      toPort < 0 ||
      toPort >= getInputPortCount(destination) ||
      connections.some(
        (connection) =>
          connection.toNodeId === toNodeId && connection.toPort === toPort,
      )
    ) {
      return;
    }
    updateContext((currentNodes, currentConnections) => ({
      nodes: currentNodes,
      connections: [
        ...currentConnections,
        {
          id: `${selectedNodeId}-to-${toNodeId}-${Date.now()}`,
          fromNodeId: selectedNodeId,
          fromPort: 0,
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

  function renderFunctionProperties() {
    if (!selectedFunction) return null;
    return (
      <div className="function-properties">
        <p className="node-id">{selectedFunction.id}</p>
        <label>
          Nome
          <input
            value={selectedFunction.name}
            onChange={(event) =>
              updateFunction((item) => ({ ...item, name: event.target.value }))
            }
          />
        </label>
        <label>
          Aridade
          <input
            type="number"
            min="0"
            value={selectedFunction.parameters.length}
            onChange={(event) => {
              const arity = Math.max(0, Number(event.target.value) || 0);
              updateFunction((item) => ({
                ...item,
                parameters: Array.from({ length: arity }, (_, index) =>
                  item.parameters[index] ?? { name: `p${index + 1}` },
                ),
              }));
            }}
          />
        </label>
        <button className="delete-node" type="button" onClick={deleteSelectedFunction}>
          Excluir função
        </button>
      </div>
    );
  }

  function renderProgramConfiguration() {
    const entryFunction =
      program.functions.find((item) => item.id === program.entryFunctionId) ??
      program.functions[0];
    if (!entryFunction) return null;
    return (
      <>
        <h3>Configuração do programa</h3>
        <p className="properties-hint">
          Escolha a função de entrada e informe seus parâmetros.
        </p>
        <label>
          Nome do programa
          <input
            value={program.name}
            onChange={(event) =>
              setProgram((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
        </label>
        <label>
          Função de entrada
          <select
            value={entryFunction.id}
            onChange={(event) => {
              const nextEntryId = event.target.value;
              const nextEntry = program.functions.find(
                (item) => item.id === nextEntryId,
              );
              if (!nextEntry) return;
              setProgram((current) => ({
                ...current,
                entryFunctionId: nextEntry.id,
                parameterValues: nextEntry.parameters.map(
                  (_, index) => current.parameterValues[index] ?? "",
                ),
              }));
            }}
          >
            {program.functions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {entryFunction.parameters.map((parameter, index) => (
          <label key={`entry-parameter-${index}`}>
            {parameter.name}
            <input
              value={program.parameterValues[index] ?? ""}
              onChange={(event) =>
                setProgram((current) => ({
                  ...current,
                  parameterValues: current.parameterValues.map((value, valueIndex) =>
                    valueIndex === index ? event.target.value : value,
                  ),
                }))
              }
            />
          </label>
        ))}
        {entryFunction.parameters.length === 0 && (
          <p className="properties-hint">
            A função de entrada não possui parâmetros.
          </p>
        )}
        <div className="program-actions">
          <button className="export-button" type="button" onClick={exportProgram}>
            Exportar
          </button>
          {exportError && <p className="export-error">{exportError}</p>}
        </div>
      </>
    );
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

  const title = activeFunction ? activeFunction.name : "Programa";

  return (
    <main className="app-shell">
      <header className="app-header">
        <strong>Pandora IDE</strong>
        <nav className="breadcrumb" aria-label="Navegação">
          <button
            type="button"
            className={activeFunction ? "breadcrumb-link" : "breadcrumb-current"}
            onClick={() => {
              setContext("root");
              setSelectedNodeId(null);
            }}
          >
            Programa
          </button>
          {activeFunction && (
            <>
              <span>/</span>
              <span className="breadcrumb-current">{activeFunction.name}</span>
            </>
          )}
        </nav>
        <span className="editor-title">{title}</span>
        <div className="node-menu">
          <button
            className="new-node-button"
            type="button"
            aria-expanded={isNodeMenuOpen}
            onClick={() => setIsNodeMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">＋</span>
            Novo
          </button>
          {isNodeMenuOpen && (
            <div className="node-menu-popover" role="menu">
              <strong>Novo</strong>
              {context === "root" && (
                <button type="button" role="menuitem" onClick={addFunction}>
                  <span className="node-menu-icon function-icon">ƒ</span>
                  <span>função</span>
                </button>
              )}
              {context !== "root" && editableNodeTypes.map((type) => (
                <button key={type} type="button" role="menuitem" onClick={() => addNode(type)}>
                  <span className="node-menu-icon" style={{ backgroundColor: nodeVisuals[type].color }}>
                    {nodeVisuals[type].label}
                  </span>
                  <span>{type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      <section className="editor-layout">
        <div className="canvas">
          <Excalidraw
            key={context}
            initialData={{ elements }}
            excalidrawAPI={setApi}
            onChange={handleChange}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: false,
                clearCanvas: false,
                export: false,
                loadScene: false,
                saveToActiveFile: false,
                toggleTheme: false,
                saveAsImage: false,
              },
              tools: { image: false },
            }}
          />
        </div>
        <aside className="properties">
          <h2>Propriedades</h2>
          {context === "root" && !selectedNode && renderProgramConfiguration()}
          {context === "root" && selectedFunction && renderFunctionProperties()}
          {context === "root" && selectedNode?.type === "funcao" && (
            <button
              className="edit-function"
              type="button"
              onClick={editSelectedFunction}
            >
              Editar função
            </button>
          )}
          {selectedNode && selectedNode.type !== "funcao" ? (
            <>
              <p className="node-id">{selectedNode.id}</p>
              <label>
                Tipo
                <select
                  value={selectedNode.type}
                  onChange={(event) =>
                    updateContext((currentNodes, currentConnections) => ({
                      nodes: currentNodes.map((node) =>
                        node.id === selectedNodeId
                          ? { ...node, type: event.target.value as PandoraNode["type"] }
                          : node,
                      ),
                      connections: currentConnections,
                    }))
                  }
                >
                  {editableNodeTypes.map((type) => (
                    <option key={type} value={type}>
                      {type} — {nodeVisuals[type].label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedNode.type === "encp" && (
                <label>
                  Função chamada
                  <select
                    value={selectedNode.functionId ?? ""}
                    onChange={(event) => {
                      const functionId = event.target.value;
                      const calledFunction = program.functions.find(
                        (item) => item.id === functionId,
                      );
                      if (!calledFunction) return;
                      const arity = calledFunction.parameters.length;
                      updateContext((currentNodes, currentConnections) => ({
                        nodes: currentNodes.map((node) =>
                          node.id === selectedNode.id
                            ? {
                                ...node,
                                functionId,
                                functionName: calledFunction.name,
                              }
                            : node,
                        ),
                        connections: currentConnections.filter(
                          (connection) =>
                            connection.toNodeId !== selectedNode.id ||
                            connection.toPort < arity,
                        ),
                      }));
                    }}
                  >
                    <option value="">Escolha uma função</option>
                    {program.functions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {selectedNode.type === "lig" && context !== "root" && (
                <>
                  <label>
                    Conector da função
                    <select
                      value={selectedNode.functionPort ?? ""}
                      onChange={(event) => {
                        const functionPort = event.target.value as
                          | ""
                          | "input"
                          | "output";
                        updateContext((currentNodes, currentConnections) => ({
                          nodes: currentNodes.map((node) =>
                            node.id === selectedNode.id
                              ? {
                                  ...node,
                                  functionPort: functionPort || undefined,
                                  functionPortIndex:
                                    functionPort === "input"
                                      ? Math.min(
                                          node.functionPortIndex ?? 0,
                                          Math.max(
                                            0,
                                            (activeFunction?.parameters.length ?? 1) - 1,
                                          ),
                                        )
                                      : undefined,
                                }
                              : node,
                          ),
                          connections: currentConnections.filter((connection) => {
                            if (connection.fromNodeId === selectedNode.id) {
                              return functionPort !== "output";
                            }
                            if (connection.toNodeId === selectedNode.id) {
                              return functionPort !== "input";
                            }
                            return true;
                          }),
                        }));
                      }}
                    >
                      <option value="">ligação interna</option>
                      <option value="input">input</option>
                      <option value="output">output</option>
                    </select>
                  </label>
                  {selectedNode.functionPort === "input" && (
                    <label>
                      Índice do input
                      <select
                        value={String(selectedNode.functionPortIndex ?? 0)}
                        onChange={(event) => {
                          const functionPortIndex = Number(event.target.value);
                          updateContext((currentNodes, currentConnections) => ({
                            nodes: currentNodes.map((node) =>
                              node.id === selectedNode.id
                                ? { ...node, functionPortIndex }
                                : node,
                            ),
                            connections: currentConnections,
                          }));
                        }}
                      >
                        {Array.from(
                          { length: activeFunction?.parameters.length ?? 0 },
                          (_, index) => (
                            <option key={index} value={index}>
                              input {index}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  )}
                </>
              )}
              {selectedNode.type === "const" && (
                <label>
                  Valor
                  <input
                    value={String(selectedNode.value ?? "")}
                    onChange={(event) =>
                      updateContext((currentNodes, currentConnections) => ({
                        nodes: currentNodes.map((node) =>
                          node.id === selectedNodeId
                            ? { ...node, value: event.target.value }
                            : node,
                        ),
                        connections: currentConnections,
                      }))
                    }
                  />
                </label>
              )}
              <button className="delete-node" type="button" onClick={deleteSelectedNode}>
                Excluir nodo
              </button>
              <label>
                Conectar a
                <select defaultValue="" onChange={(event) => addConnection(event.target.value)}>
                  <option value="">Escolha uma porta</option>
                  {nodes
                    .filter((node) => node.id !== selectedNode.id)
                    .flatMap((node) =>
                      Array.from({ length: getInputPortCount(node) }, (_, port) => (
                        <option key={`${node.id}:${port}`} value={`${node.id}:${port}`}>
                          {node.id} · entrada {port}
                        </option>
                      )),
                    )}
                </select>
              </label>
              <p className="connection-count">{connections.length} conexão(ões)</p>
            </>
          ) : (
            <p>
              {context === "root"
                ? "Selecione uma função ou abra a configuração do programa."
                : "Crie ou selecione um nodo para editar suas propriedades."}
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
