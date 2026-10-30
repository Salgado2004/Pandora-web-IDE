import type { Dispatch, SetStateAction } from "react";
import type { PandoraFunction, PandoraProgram } from "../model";

type ExecutionPanelProps = {
  entryFunction: PandoraFunction;
  program: PandoraProgram;
  setProgram: Dispatch<SetStateAction<PandoraProgram>>;
  isMinimized: boolean;
  onToggle: () => void;
  onRun: () => void;
  executionResult: unknown;
  executionError: string | null;
  formatValue: (value: unknown) => string;
};

export function ExecutionPanel({
  entryFunction,
  program,
  setProgram,
  isMinimized,
  onToggle,
  onRun,
  executionResult,
  executionError,
  formatValue,
}: ExecutionPanelProps) {
  return (
    <section className={`execution-panel ${isMinimized ? "is-minimized" : ""}`}>
      <div className="panel-header">
        <h2>Terminal</h2>
        <button
          className="panel-toggle"
          type="button"
          aria-label={isMinimized ? "Restaurar terminal" : "Minimizar terminal"}
          onClick={onToggle}
        >
          {isMinimized ? "▣" : "—"}
        </button>
      </div>
      {!isMinimized && (
        <div className="execution-content">
          <div className="execution-parameters">
            <span className="execution-label">Parâmetros</span>
            {entryFunction.parameters.length > 0 ? (
              entryFunction.parameters.map((parameter, index) => (
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
              ))
            ) : (
              <span className="execution-placeholder">Sem parâmetros</span>
            )}
          </div>
          <button className="run-button" type="button" onClick={onRun}>
            Executar
          </button>
          {executionError && <p className="execution-error">{executionError}</p>}
          {executionResult !== undefined && (
            <p className="execution-result">
              Resultado: <strong>{formatValue(executionResult)}</strong>
            </p>
          )}
          {executionError === null && executionResult === undefined && (
            <p className="execution-placeholder">A saída da execução aparecerá aqui.</p>
          )}
        </div>
      )}
    </section>
  );
}
