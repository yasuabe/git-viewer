import { contextBridge, ipcRenderer } from "electron";
import type { GitViewerApi } from "../../src/types/repository";

const REPOSITORY_CHANGED_CHANNEL = "repository:changed";

const gitViewerApi: GitViewerApi = {
  loadCurrentRepository() {
    return ipcRenderer.invoke("repository:load-current");
  },
  loadCommitFiles(commitHash) {
    return ipcRenderer.invoke("repository:load-commit-files", commitHash);
  },
  loadCommitDiff(commitHash, path) {
    return ipcRenderer.invoke("repository:load-commit-diff", commitHash, path);
  },
  loadWipDiff(kind, path, status) {
    return ipcRenderer.invoke("repository:load-wip-diff", kind, path, status);
  },
  onRepositoryChanged(listener) {
    const wrappedListener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => {
      listener(payload);
    };

    ipcRenderer.on(REPOSITORY_CHANGED_CHANNEL, wrappedListener);

    return () => {
      ipcRenderer.off(REPOSITORY_CHANGED_CHANNEL, wrappedListener);
    };
  },
};

contextBridge.exposeInMainWorld("gitViewer", gitViewerApi);
