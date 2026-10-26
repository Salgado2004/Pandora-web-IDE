declare module "@pandora-lang/interpreter" {
  type PandoraValue = string | number | boolean;

  type PandoraInterpreterFile = {
    nome: string;
    entradas: PandoraValue[];
    estado: number;
    lista: unknown[];
    saidas: unknown;
  };

  type PandoraProgram = {
    estado: number;
    resultado?: unknown;
  };

  export function normalizarArquivo(dados: unknown): PandoraInterpreterFile;
  export function Interpretador(
    arquivo: PandoraInterpreterFile,
    opcoes?: boolean | { verbose?: boolean },
  ): PandoraProgram;
}
