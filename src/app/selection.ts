import type { RepositorySnapshot } from "../types/repository";
import type { SelectedCommit } from "../types/git";
import type { SelectedFile } from "./types";

export function initialSelection(snapshot: RepositorySnapshot): SelectedCommit | null {
  if (hasWipChanges(snapshot)) {
    return { type: "wip" };
  }

  if (snapshot.commits.length > 0) {
    return { type: "commit", hash: snapshot.commits[0].hash };
  }

  return null;
}

export function hasWipChanges(snapshot: RepositorySnapshot): boolean {
  return snapshot.wip.staged.length > 0 || snapshot.wip.unstaged.length > 0;
}

export function resolveSelectedCommit(
  previousSelectedCommit: SelectedCommit | null,
  snapshot: RepositorySnapshot,
): SelectedCommit | null {
  if (!previousSelectedCommit) {
    return initialSelection(snapshot);
  }

  if (previousSelectedCommit.type === "commit") {
    return snapshot.commits.some((commit) => commit.hash === previousSelectedCommit.hash)
      ? previousSelectedCommit
      : initialSelection(snapshot);
  }

  return hasWipChanges(snapshot) ? previousSelectedCommit : initialSelection(snapshot);
}

export function resolveSelectedFile(
  previousSelectedFile: SelectedFile | null,
  nextSelectedCommit: SelectedCommit | null,
  snapshot: RepositorySnapshot,
): SelectedFile | null {
  if (!previousSelectedFile) {
    return null;
  }

  if (previousSelectedFile.kind === "commit") {
    return nextSelectedCommit?.type === "commit" && nextSelectedCommit.hash === previousSelectedFile.commitHash
      ? previousSelectedFile
      : null;
  }

  const files = previousSelectedFile.kind === "staged" ? snapshot.wip.staged : snapshot.wip.unstaged;

  return files.some((file) => file.path === previousSelectedFile.path)
    ? { ...previousSelectedFile }
    : null;
}

export function selectedFileKey(selectedFile: SelectedFile): string {
  if (selectedFile.kind === "commit") {
    return `commit:${selectedFile.commitHash}:${selectedFile.path}`;
  }

  return `${selectedFile.kind}:${selectedFile.path}`;
}
