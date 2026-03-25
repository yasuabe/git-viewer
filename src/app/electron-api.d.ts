import type { GitViewerApi } from "../types/repository";

declare global {
  interface Window {
    gitViewer: GitViewerApi;
  }
}

export {};
