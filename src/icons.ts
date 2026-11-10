import {
  faArrowUpRightFromSquare,
  faBackwardStep,
  faCircleDot,
  faCirclePlus,
  faCircleXmark,
  faDivide,
  faEquals,
  faForwardStep,
  faCode,
  faGreaterThan,
  faLessThan,
  faLink,
  faList,
  faMinus,
  faNotEqual,
  faPlus,
  faSquareRootVariable,
  faXmark,
  faC,
  faCodeFork,
  faCodeMerge,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { faCreativeCommonsZero } from "@fortawesome/free-brands-svg-icons";
import type { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/excalidraw/element/types";
import type { PandoraNodeType } from "./model";
import { nodeVisuals } from "./model";

const icons: Record<string, IconDefinition> = {
  "fa-solid fa-link": faLink,
  "fa-solid fa-c": faC,
  "fa-solid fa-plus": faPlus,
  "fa-solid fa-minus": faMinus,
  "fa-solid fa-xmark": faXmark,
  "fa-solid fa-divide": faDivide,
  "fa-solid fa-equals": faEquals,
  "fa-solid fa-not-equal": faNotEqual,
  "fa-solid fa-less-than": faLessThan,
  "fa-solid fa-greater-than": faGreaterThan,
  "fa-solid fa-function": faCode,
  "fa-solid fa-code-fork": faCodeFork,
  "fa-solid fa-code-merge": faCodeMerge,
  "fa-solid fa-square-root-variable": faSquareRootVariable,
  "fa-solid fa-lambda": faCode,
  "fa-solid fa-arrow-up-right-from-square": faArrowUpRightFromSquare,
  "fa-solid fa-list": faList,
  "fa-solid fa-circle-plus": faCirclePlus,
  "fa-solid fa-backward-step": faBackwardStep,
  "fa-solid fa-forward-step": faForwardStep,
  "fa-brands fa-creative-commons-zero": faCreativeCommonsZero,
};

export function nodeIcon(type: PandoraNodeType): IconDefinition {
  return icons[nodeVisuals[type].iconClass] ?? faCircleDot;
}

export function nodeIconGlyph(type: PandoraNodeType): string {
  return String.fromCodePoint(parseInt(nodeIcon(type).icon[3], 16));
}

const iconFiles: Record<string, BinaryFileData> = {};

export function nodeIconFileId(type: PandoraNodeType): FileId {
  const iconClass = nodeVisuals[type].iconClass;
  const fileId = `pandora-icon-v2-${iconClass.replace(/[^a-z0-9-]/gi, "-")}`;
  if (!iconFiles[fileId]) {
    const icon = nodeIcon(type);
    const [width, height, , , path] = icon.icon;
    const paths = Array.isArray(path) ? path : [path];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path fill="#34324a" d="${paths.join(" ")}"/></svg>`;
    iconFiles[fileId] = {
      id: fileId as FileId,
      mimeType: "image/svg+xml",
      created: Date.now(),
      dataURL: `data:image/svg+xml;base64,${btoa(svg)}` as DataURL,
    };
  }
  return fileId as FileId;
}

export function getNodeIconFiles() {
  (Object.keys(nodeVisuals) as PandoraNodeType[]).forEach(nodeIconFileId);
  return Object.values(iconFiles);
}
