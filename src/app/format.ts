import type { BranchRecord, RepositoryChangeEvent } from "../types/repository";
import type { WipFile } from "../types/git";

const SHORT_HASH_LENGTH = 6;

export function statusClassName(status: WipFile["status"]): string {
  return `wip-status wip-status-${status.toLowerCase()}`;
}

export function refSummary(refs: BranchRecord[]): string {
  const locals = refs.filter((ref) => ref.kind === "local").length;
  const remotes = refs.filter((ref) => ref.kind === "remote").length;
  const tags = refs.filter((ref) => ref.kind === "tag").length;
  return `${locals} local · ${remotes} remote · ${tags} tags`;
}

export function lastPathSegment(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
}

export function splitRefs(refs: BranchRecord[]) {
  return {
    local: refs.filter((ref) => ref.kind === "local"),
    remote: refs.filter((ref) => ref.kind === "remote"),
    tag: refs.filter((ref) => ref.kind === "tag"),
  };
}

export function splitCommitMessage(message: string) {
  const [subject = "", ...bodyLines] = message.split("\n");
  return {
    subject,
    body: bodyLines.join("\n").trim(),
  };
}

export function formatShortHash(hash: string) {
  return hash.slice(0, SHORT_HASH_LENGTH);
}

export function formatRepositoryChange(event: RepositoryChangeEvent | null): string {
  if (!event) {
    return "watch idle";
  }

  const label =
    event.kind === "repository"
      ? "repository changed"
      : event.kind === "head"
      ? "HEAD changed"
      : event.kind === "index"
        ? "index changed"
        : event.kind === "worktree"
          ? "worktree changed"
          : "refs changed";
  const timeLabel = new Date(event.occurredAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return `${label} · ${timeLabel}`;
}
