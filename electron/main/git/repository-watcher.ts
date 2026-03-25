import path from "node:path";
import { watch, type FSWatcher } from "node:fs";
import simpleGit from "simple-git";
import type { RepositoryChangeEvent, RepositoryChangeKind } from "../../../src/types/repository";

type StopWatching = () => void;

type RepositoryRootTarget = {
  directory: string;
  fileKinds: Record<string, RepositoryChangeKind>;
};

type RefsTarget = {
  directory: string;
  kind: "refs";
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
  const refsTargets: RefsTarget[] = [
    { directory: path.join(gitDirPath, "refs", "heads"), kind: "refs" },
    { directory: path.join(gitDirPath, "refs", "remotes"), kind: "refs" },
    { directory: path.join(gitDirPath, "refs", "tags"), kind: "refs" },
  ];

  const watchers = [
    createRepositoryRootWatcher(rootTarget, onChange),
    ...refsTargets.map((target) => createRefsWatcher(target, onChange)),
  ]
    .filter((watcher): watcher is FSWatcher => watcher !== null);

  return () => {
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

function createRefsWatcher(
  target: RefsTarget,
  onChange: (event: RepositoryChangeEvent) => void,
): FSWatcher | null {
  try {
    return watch(target.directory, (_eventType, filename) => {
      const normalizedFilename = normalizeFilename(filename);

      onChange({
        kind: target.kind,
        path: normalizedFilename ? path.join(target.directory, normalizedFilename) : target.directory,
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
