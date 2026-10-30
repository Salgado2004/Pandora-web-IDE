import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, ExcalidrawProps } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

type EditorCanvasProps = {
  context: string;
  elements: ExcalidrawElement[];
  onApi: (api: ExcalidrawImperativeAPI) => void;
  onChange: NonNullable<ExcalidrawProps["onChange"]>;
  onPointerDown: () => void;
  onPointerUp: () => void;
};

export function EditorCanvas({
  context,
  elements,
  onApi,
  onChange,
  onPointerDown,
  onPointerUp,
}: EditorCanvasProps) {
  return (
    <div className="canvas">
      <Excalidraw
        key={context}
        initialData={{ elements }}
        excalidrawAPI={onApi}
        onChange={onChange}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
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
  );
}
