import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, dialog, ipcMain, type MessageBoxOptions, type OpenDialogOptions } from "electron";
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
const ELECTRON_RENDERER_URL = process.env.ELECTRON_RENDERER_URL;
const REPOSITORY_CHANGED_CHANNEL = "repository:changed";
let currentRepositoryPath = DEFAULT_REPOSITORY_PATH;
let stopWatchingRepository: (() => void) | null = null;

if (process.platform === "linux") {
  app.commandLine.appendSwitch("disable-gpu");
}

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

  if (ELECTRON_RENDERER_URL) {
    void window.loadURL(ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  return window;
}

function broadcastRepositoryChanged(event: {
  kind: "head" | "index" | "refs" | "worktree" | "repository";
  path: string;
  occurredAt: string;
}) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(REPOSITORY_CHANGED_CHANNEL, event);
  }
}

async function restartRepositoryWatcher() {
  stopWatchingRepository?.();
  stopWatchingRepository = await watchRepositoryChanges(currentRepositoryPath, (event) => {
    broadcastRepositoryChanged(event);
  });
}

async function openRepositoryFromDialog(parentWindow: BrowserWindow | null) {
  const dialogOptions: OpenDialogOptions = {
    title: "Open Repository",
    properties: ["openDirectory"],
  };
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (result.canceled || result.filePaths.length === 0) {
    return;
  }

  const [nextRepositoryPath] = result.filePaths;

  try {
    await loadRepositorySnapshot(nextRepositoryPath);
    currentRepositoryPath = nextRepositoryPath;
    await restartRepositoryWatcher();
    broadcastRepositoryChanged({
      kind: "repository",
      path: path.resolve(nextRepositoryPath),
      occurredAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected repository open failure.";
    const messageBoxOptions: MessageBoxOptions = {
      type: "error",
      title: "Cannot Open Repository",
      message: "The selected directory could not be opened as a Git repository.",
      detail: message,
    };

    if (parentWindow) {
      await dialog.showMessageBox(parentWindow, messageBoxOptions);
    } else {
      await dialog.showMessageBox(messageBoxOptions);
    }
  }
}

function createApplicationMenu() {
  return Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        {
          label: "Open Repository...",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            void openRepositoryFromDialog(BrowserWindow.getFocusedWindow());
          },
        },
        {
          type: "separator",
        },
        {
          role: "quit",
        },
      ],
    },
  ]);
}

function registerIpcHandlers() {
  ipcMain.handle("repository:load-current", async () => {
    try {
      return await loadRepositorySnapshot(currentRepositoryPath);
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
      return await loadCommitFiles(currentRepositoryPath, commitHash);
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
      return await loadCommitDiff(currentRepositoryPath, commitHash, filePath);
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
        return await loadWipDiff(currentRepositoryPath, kind, filePath, status);
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
  Menu.setApplicationMenu(createApplicationMenu());
  void restartRepositoryWatcher();

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
