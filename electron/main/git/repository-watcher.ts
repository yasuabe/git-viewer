import path from "node:path";
import { watch, type FSWatcher } from "node:fs";
import simpleGit from "simple-git";
import type { RepositoryChangeEvent, RepositoryChangeKind } from "../../../src/types/repository";

type StopWatching = () => void;
const STATUS_POLL_INTERVAL_MS = 1500;
const STATUS_COMMAND = ["status", "--porcelain=v1", "--untracked-files=all"] as const;
const REFS_POLL_INTERVAL_MS = 1500;
const REFS_COMMAND = ["for-each-ref", "refs/heads", "refs/remotes", "refs/tags"] as const;

type RepositoryRootTarget = {
  directory: string;
  fileKinds: Record<string, RepositoryChangeKind>;
};

export async function watchRepositoryChanges(
  repositoryPath: string,
  onChange: (event: RepositoryChangeEvent) => void,
): Promise<StopWatching> {
  const normalizedRepositoryPath = path.resolve(repositoryPath);
  const git = simpleGit(normalizedRepositoryPath);
  const gitDirOutput = await git.raw(["rev-parse", "--git-dir"]);
  const gitDirPath = path.resolve(normalizedRepositoryPath, gitDirOutput.trim());

  const rootTarget: RepositoryRootTarget = {
    directory: gitDirPath,
    fileKinds: {
      HEAD: "head",
      index: "index",
      "packed-refs": "refs",
    },
  };
  const watchers = [createRepositoryRootWatcher(rootTarget, onChange)].filter(
    (watcher): watcher is FSWatcher => watcher !== null,
  );
  const stopPollingStatus = startStatusPolling(normalizedRepositoryPath, git, onChange);
  const stopPollingRefs = startRefsPolling(gitDirPath, git, onChange);

  return () => {
    stopPollingStatus();
    stopPollingRefs();

    for (const watcher of watchers) {
      watcher.close();
    }
  };
}

function createRepositoryRootWatcher(
  target: RepositoryRootTarget,
  onChange: (event: RepositoryChangeEvent) => void,
): FSWatcher | null {
  try {
    return watch(target.directory, (_eventType, filename) => {
      const normalizedFilename = normalizeFilename(filename);

      if (!normalizedFilename) {
        return;
      }

      const kind = target.fileKinds[normalizedFilename];

      if (!kind) {
        return;
      }

      onChange({
        kind,
        path: path.join(target.directory, normalizedFilename),
        occurredAt: new Date().toISOString(),
      });
    });
  } catch {
    return null;
  }
}

function normalizeFilename(filename: string | Buffer | null): string {
  if (!filename) {
    return "";
  }

  return typeof filename === "string" ? filename : filename.toString("utf8");
}

function startStatusPolling(
  repositoryPath: string,
  git: ReturnType<typeof simpleGit>,
  onChange: (event: RepositoryChangeEvent) => void,
): StopWatching {
  let previousStatusOutput: string | null = null;
  let isPolling = false;

  async function pollStatus() {
    if (isPolling) {
      return;
    }

    isPolling = true;

    try {
      const nextStatusOutput = await git.raw([...STATUS_COMMAND]);

      if (previousStatusOutput === null) {
        previousStatusOutput = nextStatusOutput;
        return;
      }

      if (nextStatusOutput !== previousStatusOutput) {
        previousStatusOutput = nextStatusOutput;
        onChange({
          kind: "worktree",
          path: repositoryPath,
          occurredAt: new Date().toISOString(),
        });
      }
    } catch {
      return;
    } finally {
      isPolling = false;
    }
  }

  void pollStatus();

  const intervalId = setInterval(() => {
    void pollStatus();
  }, STATUS_POLL_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
  };
}

function startRefsPolling(
  gitDirPath: string,
  git: ReturnType<typeof simpleGit>,
  onChange: (event: RepositoryChangeEvent) => void,
): StopWatching {
  let previousRefsOutput: string | null = null;
  let isPolling = false;

  async function pollRefs() {
    if (isPolling) {
      return;
    }

    isPolling = true;

    try {
      const nextRefsOutput = await git.raw([...REFS_COMMAND]);

      if (previousRefsOutput === null) {
        previousRefsOutput = nextRefsOutput;
        return;
      }

      if (nextRefsOutput !== previousRefsOutput) {
        previousRefsOutput = nextRefsOutput;
        onChange({
          kind: "refs",
          path: path.join(gitDirPath, "refs"),
          occurredAt: new Date().toISOString(),
        });
      }
    } catch {
      return;
    } finally {
      isPolling = false;
    }
  }

  void pollRefs();

  const intervalId = setInterval(() => {
    void pollRefs();
  }, REFS_POLL_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
  };
}
