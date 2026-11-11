import { useState } from "react";
import type { PandoraNodeType } from "../model";
import { nodeVisuals } from "../model";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { nodeIcon } from "../icons";

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
  const nodeSections: Array<{ title: string; types: PandoraNodeType[] }> = [
    { title: "Fluxo", types: ["lig", "const"] },
    { title: "Operadores aritméticos", types: ["soma", "subs", "mult", "divs", "resto"] },
    { title: "Operadores lógicos", types: ["igual", "ngual", "meno", "maio"] },
    { title: "Funções", types: ["encp", "func", "apply"] },
    { title: "Listas", types: ["list", "cons", "head", "tail", "is-empty"] },
    { title: "Condicional", types: ["disor"] },
  ];
  const [collapsedSections, setCollapsedSections] = useState(
    () => new Set(nodeSections.map((section) => section.title)),
  );

  function toggleSection(title: string) {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

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
              nodeSections.map((section) => (
                <section className="node-menu-section" key={section.title}>
                <button
                  className="node-menu-section-toggle"
                  type="button"
                  aria-expanded={!collapsedSections.has(section.title)}
                  onClick={() => toggleSection(section.title)}
                >
                  <strong>{section.title}</strong>
                  <span aria-hidden="true">
                    {collapsedSections.has(section.title) ? "▸" : "▾"}
                  </span>
                </button>
                {!collapsedSections.has(section.title) &&
                  section.types.map((type) => (
                    <button
                      key={type}
                      type="button"
                      role="menuitem"
                      onClick={() => onAddNode(type)}
                    >
                      <span
                        className="node-menu-icon"
                        style={{ backgroundColor: nodeVisuals[type].color }}
                      >
                        <FontAwesomeIcon icon={nodeIcon(type)} />
                      </span>
                      <span>{type}</span>
                    </button>
                  ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
