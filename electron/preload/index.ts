import { contextBridge, ipcRenderer } from "electron";
import type { GitViewerApi } from "../../src/types/repository";

const gitViewerApi: GitViewerApi = {
  loadDefaultRepository() {
    return ipcRenderer.invoke("repository:load-default");
  },
};

contextBridge.exposeInMainWorld("gitViewer", gitViewerApi);
