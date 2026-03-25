import { contextBridge, ipcRenderer } from "electron";
import type { GitViewerApi } from "../../src/types/repository";

const gitViewerApi: GitViewerApi = {
  loadDefaultRepository() {
    return ipcRenderer.invoke("repository:load-default");
  },
  loadCommitFiles(commitHash) {
    return ipcRenderer.invoke("repository:load-commit-files", commitHash);
  },
  loadCommitDiff(commitHash, path) {
    return ipcRenderer.invoke("repository:load-commit-diff", commitHash, path);
  },
};

contextBridge.exposeInMainWorld("gitViewer", gitViewerApi);
