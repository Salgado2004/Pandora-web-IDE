import type { PandoraNodeType } from "../model";
import { editableNodeTypes, nodeVisuals } from "../model";

type EditorHeaderProps = {
  activeFunctionName?: string;
  context: "root" | string;
  isNodeMenuOpen: boolean;
  onGoToRoot: () => void;
  onToggleMenu: () => void;
  onAddFunction: () => void;
  onAddNode: (type: PandoraNodeType) => void;
};

export function EditorHeader({
  activeFunctionName,
  context,
  isNodeMenuOpen,
  onGoToRoot,
  onToggleMenu,
  onAddFunction,
  onAddNode,
}: EditorHeaderProps) {
  const title = activeFunctionName ?? "Programa";

  return (
    <header className="app-header">
      <strong>Pandora IDE</strong>
      <nav className="breadcrumb" aria-label="Navegação">
        <button
          type="button"
          className={activeFunctionName ? "breadcrumb-link" : "breadcrumb-current"}
          onClick={onGoToRoot}
        >
          Programa
        </button>
        {activeFunctionName && (
          <>
            <span>/</span>
            <span className="breadcrumb-current">{activeFunctionName}</span>
          </>
        )}
      </nav>
      <span className="editor-title">{title}</span>
      <div className="node-menu">
        <button
          className="new-node-button"
          type="button"
          aria-expanded={isNodeMenuOpen}
          onClick={onToggleMenu}
        >
          <span aria-hidden="true">＋</span>
          Novo
        </button>
        {isNodeMenuOpen && (
          <div className="node-menu-popover" role="menu">
            <strong>Novo</strong>
            {context === "root" && (
              <button type="button" role="menuitem" onClick={onAddFunction}>
                <span className="node-menu-icon function-icon">ƒ</span>
                <span>função</span>
              </button>
            )}
            {context !== "root" &&
              editableNodeTypes.map((type) => (
                <button key={type} type="button" role="menuitem" onClick={() => onAddNode(type)}>
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
  );
}
