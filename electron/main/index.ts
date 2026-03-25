import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import { RepositoryLoadError, loadRepositorySnapshot } from "./git/repository-service";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RENDERER_DIST = path.join(__dirname, "../renderer");
const PRELOAD_ENTRY = path.join(__dirname, "../preload/index.mjs");
const DEFAULT_REPOSITORY_PATH = process.env.GIT_VIEWER_REPOSITORY_PATH ?? app.getAppPath();
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

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
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

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
