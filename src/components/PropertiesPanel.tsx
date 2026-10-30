import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react";
import {
  editableNodeTypes,
  inputPortCount,
  nodeVisuals,
  type PandoraConnection,
  type PandoraFunction,
  type PandoraNode,
  type PandoraProgram,
} from "../model";

type UpdateContext = (
  updater: (nodes: PandoraNode[], connections: PandoraConnection[]) => {
    nodes: PandoraNode[];
    connections: PandoraConnection[];
  },
) => void;

type PropertiesPanelProps = {
  context: "root" | string;
  program: PandoraProgram;
  setProgram: Dispatch<SetStateAction<PandoraProgram>>;
  activeFunction?: PandoraFunction;
  selectedNode?: PandoraNode;
  selectedFunction?: PandoraFunction;
  selectedNodeId: string | null;
  nodes: PandoraNode[];
  connections: PandoraConnection[];
  isMinimized: boolean;
  onToggle: () => void;
  updateContext: UpdateContext;
  updateFunction: (updater: (item: PandoraFunction) => PandoraFunction) => void;
  onEditFunction: () => void;
  onDeleteNode: () => void;
  onDeleteFunction: () => void;
  getInputPortCount: (node: PandoraNode) => number;
  addConnection: (targetValue: string, sourcePort?: number) => void;
  importInputRef: RefObject<HTMLInputElement | null>;
  exportError: string | null;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function PropertiesPanel({
  context,
  program,
  setProgram,
  activeFunction,
  selectedNode,
  selectedFunction,
  selectedNodeId,
  nodes,
  connections,
  isMinimized,
  onToggle,
  updateContext,
  updateFunction,
  onEditFunction,
  onDeleteNode,
  onDeleteFunction,
  getInputPortCount,
  addConnection,
  importInputRef,
  exportError,
  onExport,
  onImport,
}: PropertiesPanelProps) {
  const entryFunction =
    program.functions.find((item) => item.id === program.entryFunctionId) ??
    program.functions[0];
  const branchTarget = (port: number) =>
    connections.find(
      (connection) =>
        connection.fromNodeId === selectedNode?.id && connection.fromPort === port,
    )?.toNodeId ?? "";
  return (
    <aside className={`properties ${isMinimized ? "is-minimized" : ""}`}>
      <div className="panel-header">
        {!isMinimized && <h2>Propriedades</h2>}
        <button
          className="panel-toggle"
          type="button"
          aria-label={isMinimized ? "Restaurar propriedades" : "Minimizar propriedades"}
          onClick={onToggle}
        >
          {isMinimized ? "▣" : "—"}
        </button>
      </div>
      {!isMinimized && (
        <>
          {context === "root" && !selectedNode && entryFunction && (
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
                    setProgram((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label>
                Função de entrada
                <select
                  value={entryFunction.id}
                  onChange={(event) => {
                    const nextEntry = program.functions.find(
                      (item) => item.id === event.target.value,
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
              <button className="export-button" type="button" onClick={onExport}>
                Exportar
              </button>
              <button
                className="export-button"
                type="button"
                onClick={() => importInputRef.current?.click()}
              >
                Importar
              </button>
              <input
                ref={importInputRef}
                className="file-input"
                type="file"
                accept="application/json,.json"
                onChange={onImport}
              />
              {exportError && <p className="export-error">{exportError}</p>}
            </>
          )}
          {context === "root" && selectedFunction && (
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
                      parameters: Array.from(
                        { length: arity },
                        (_, index) => item.parameters[index] ?? { name: `p${index + 1}` },
                      ),
                    }));
                  }}
                />
              </label>
              <button className="delete-node" type="button" onClick={onDeleteFunction}>
                Excluir função
              </button>
            </div>
          )}
          {context === "root" && selectedNode?.type === "funcao" && (
            <button className="edit-function" type="button" onClick={onEditFunction}>
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
                      const calledFunction = program.functions.find(
                        (item) => item.id === event.target.value,
                      );
                      if (!calledFunction) return;
                      updateContext((currentNodes, currentConnections) => ({
                        nodes: currentNodes.map((node) =>
                          node.id === selectedNode.id
                            ? {
                                ...node,
                                functionId: calledFunction.id,
                                functionName: calledFunction.name,
                              }
                            : node,
                        ),
                        connections: currentConnections.filter(
                          (connection) =>
                            connection.toNodeId !== selectedNode.id ||
                            connection.toPort < calledFunction.parameters.length,
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
                        const functionPort = event.target.value as "" | "input" | "output";
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
                        onChange={(event) =>
                          updateContext((currentNodes, currentConnections) => ({
                            nodes: currentNodes.map((node) =>
                              node.id === selectedNode.id
                                ? { ...node, functionPortIndex: Number(event.target.value) }
                                : node,
                            ),
                            connections: currentConnections,
                          }))
                        }
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
                          node.id === selectedNodeId ? { ...node, value: event.target.value } : node,
                        ),
                        connections: currentConnections,
                      }))
                    }
                  />
                </label>
              )}
              <button className="delete-node" type="button" onClick={onDeleteNode}>
                Excluir nodo
              </button>
              {selectedNode.type === "disor" && (
                <>
                  <label>
                    Ramo caso true
                    <select
                      value={branchTarget(0)}
                      onChange={(event) => addConnection(event.target.value, 0)}
                    >
                      <option value="">Escolha o nodo do ramo true</option>
                      {nodes
                        .filter((node) => node.id !== selectedNode.id)
                        .map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.id}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Ramo caso false
                    <select
                      value={branchTarget(1)}
                      onChange={(event) => addConnection(event.target.value, 1)}
                    >
                      <option value="">Escolha o nodo do ramo false</option>
                      {nodes
                        .filter((node) => node.id !== selectedNode.id)
                        .map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.id}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              <label>
                {selectedNode.type === "disor" ? "Conectar entrada" : "Conectar a"}
                <select defaultValue="" onChange={(event) => addConnection(event.target.value)}>
                  <option value="">
                    {selectedNode.type === "disor"
                      ? "Escolha uma porta"
                      : "Escolha uma porta"}
                  </option>
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
        </>
      )}
    </aside>
  );
}
