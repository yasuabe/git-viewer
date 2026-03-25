import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import {
  RepositoryLoadError,
  loadCommitDiff,
  loadCommitFiles,
  loadRepositorySnapshot,
  loadWipDiff,
} from "./git/repository-service";
import { watchRepositoryChanges } from "./git/repository-watcher";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RENDERER_DIST = path.join(__dirname, "../renderer");
const PRELOAD_ENTRY = path.join(__dirname, "../preload/index.mjs");
const DEFAULT_REPOSITORY_PATH = process.env.GIT_VIEWER_REPOSITORY_PATH ?? app.getAppPath();
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const REPOSITORY_CHANGED_CHANNEL = "repository:changed";

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#07111d",
    webPreferences: {
      preload: PRELOAD_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    void window.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  return window;
}

function registerIpcHandlers() {
  ipcMain.handle("repository:load-default", async () => {
    try {
      return await loadRepositorySnapshot(DEFAULT_REPOSITORY_PATH);
    } catch (error) {
      if (error instanceof RepositoryLoadError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unexpected repository load failure.";
      throw new Error(message);
    }
  });

  ipcMain.handle("repository:load-commit-files", async (_event, commitHash: string) => {
    try {
      return await loadCommitFiles(DEFAULT_REPOSITORY_PATH, commitHash);
    } catch (error) {
      if (error instanceof RepositoryLoadError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unexpected commit file load failure.";
      throw new Error(message);
    }
  });

  ipcMain.handle("repository:load-commit-diff", async (_event, commitHash: string, filePath: string) => {
    try {
      return await loadCommitDiff(DEFAULT_REPOSITORY_PATH, commitHash, filePath);
    } catch (error) {
      if (error instanceof RepositoryLoadError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unexpected commit diff load failure.";
      throw new Error(message);
    }
  });

  ipcMain.handle(
    "repository:load-wip-diff",
    async (_event, kind: "staged" | "unstaged", filePath: string, status: "A" | "M" | "D" | "R") => {
      try {
        return await loadWipDiff(DEFAULT_REPOSITORY_PATH, kind, filePath, status);
      } catch (error) {
        if (error instanceof RepositoryLoadError) {
          throw error;
        }

        const message = error instanceof Error ? error.message : "Unexpected WIP diff load failure.";
        throw new Error(message);
      }
    },
  );
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
  void watchRepositoryChanges(DEFAULT_REPOSITORY_PATH, (event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(REPOSITORY_CHANGED_CHANNEL, event);
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
