import { useEffect, useMemo, useRef, useState } from "react";
import { DagView } from "../components/dag-view/DagView";
import { assignLanes } from "../components/dag-view/layout/assign-lanes";
import DiffView from "../components/diff-view/DiffView";
import type {
  BranchRecord,
  CommitFileChange,
  RepositoryChangeEvent,
  RepositorySnapshot,
} from "../types/repository";
import type { DiffViewData } from "../types/diff";
import type { SelectedCommit, WipFile } from "../types/git";

const REPOSITORY_RELOAD_DEBOUNCE_MS = 300;

type SelectedFile =
  | {
      kind: "commit";
      commitHash: string;
      path: string;
      status: CommitFileChange["status"];
    }
  | {
      kind: "staged" | "unstaged";
      path: string;
      status: WipFile["status"];
    };

function statusClassName(status: WipFile["status"]): string {
  return `wip-status wip-status-${status.toLowerCase()}`;
}

function refSummary(refs: BranchRecord[]): string {
  const locals = refs.filter((ref) => ref.kind === "local").length;
  const remotes = refs.filter((ref) => ref.kind === "remote").length;
  const tags = refs.filter((ref) => ref.kind === "tag").length;
  return `${locals} local · ${remotes} remote · ${tags} tags`;
}

function lastPathSegment(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).at(-1) ?? path;
}

function splitRefs(refs: BranchRecord[]) {
  return {
    local: refs.filter((ref) => ref.kind === "local"),
    remote: refs.filter((ref) => ref.kind === "remote"),
    tag: refs.filter((ref) => ref.kind === "tag"),
  };
}

function splitCommitMessage(message: string) {
  const [subject = "", ...bodyLines] = message.split("\n");
  return {
    subject,
    body: bodyLines.join("\n").trim(),
  };
}

function formatRepositoryChange(event: RepositoryChangeEvent | null): string {
  if (!event) {
    return "watch idle";
  }

  const label =
    event.kind === "head"
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

function initialSelection(snapshot: RepositorySnapshot): SelectedCommit | null {
  if (hasWipChanges(snapshot)) {
    return { type: "wip" };
  }

  if (snapshot.commits.length > 0) {
    return { type: "commit", hash: snapshot.commits[0].hash };
  }

  return null;
}

function hasWipChanges(snapshot: RepositorySnapshot): boolean {
  return snapshot.wip.staged.length > 0 || snapshot.wip.unstaged.length > 0;
}

function resolveSelectedCommit(
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

function resolveSelectedFile(
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

type FileListSectionProps = {
  title: string;
  files: Array<{ path: string; status: WipFile["status"] }>;
  selectedFile: SelectedFile | null;
  onSelectFile: (selectedFile: SelectedFile) => void;
  kind: SelectedFile["kind"];
  commitHash?: string;
  isLoading?: boolean;
  emptyMessage: string;
};

function FileListSection({
  title,
  files,
  selectedFile,
  onSelectFile,
  kind,
  commitHash,
  isLoading = false,
  emptyMessage,
}: FileListSectionProps) {
  return (
    <section className="right-pane-split-section">
      <div className="right-pane-split-header">
        <p className="right-pane-label">{title}</p>
        <span className="right-pane-count">{isLoading ? "..." : files.length}</span>
      </div>
      {isLoading ? (
        <div className="right-pane-scroll-area right-pane-placeholder">
          <p className="selection-meta">ファイル一覧を取得しています。</p>
        </div>
      ) : files.length > 0 ? (
        <div className="right-pane-scroll-area">
          <ul className="right-pane-file-list">
            {files.map((file) => {
              const isActive =
                selectedFile?.path === file.path &&
                selectedFile.kind === kind &&
                (selectedFile.kind !== "commit" || selectedFile.commitHash === commitHash);

              return (
                <li key={`${kind}-${file.path}`}>
                  <button
                    className={`right-pane-file-button${isActive ? " right-pane-file-button-active" : ""}`}
                    type="button"
                    onClick={() =>
                      onSelectFile(
                        kind === "commit"
                          ? {
                              kind,
                              commitHash: commitHash ?? "",
                              path: file.path,
                              status: file.status,
                            }
                          : {
                              kind,
                              path: file.path,
                              status: file.status,
                            },
                      )
                    }
                  >
                    <span className={statusClassName(file.status)}>{file.status}</span>
                    <code>{file.path}</code>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="right-pane-scroll-area right-pane-placeholder">
          <p className="selection-meta">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<SelectedCommit | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [commitFiles, setCommitFiles] = useState<CommitFileChange[]>([]);
  const [commitFilesError, setCommitFilesError] = useState<string | null>(null);
  const [isCommitFilesLoading, setIsCommitFilesLoading] = useState(false);
  const [overlayDiff, setOverlayDiff] = useState<DiffViewData | null>(null);
  const [overlayDiffError, setOverlayDiffError] = useState<string | null>(null);
  const [isOverlayDiffLoading, setIsOverlayDiffLoading] = useState(false);
  const [lastRepositoryChange, setLastRepositoryChange] = useState<RepositoryChangeEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [repositoryReloadVersion, setRepositoryReloadVersion] = useState(0);
  const selectedCommitRef = useRef<SelectedCommit | null>(null);
  const selectedFileRef = useRef<SelectedFile | null>(null);
  const reloadDebounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    selectedCommitRef.current = selectedCommit;
  }, [selectedCommit]);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  useEffect(() => {
    let cancelled = false;

    async function loadRepository() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextSnapshot = await window.gitViewer.loadDefaultRepository();

        if (cancelled) {
          return;
        }

        const nextSelectedCommit = resolveSelectedCommit(selectedCommitRef.current, nextSnapshot);
        const nextSelectedFile = resolveSelectedFile(selectedFileRef.current, nextSelectedCommit, nextSnapshot);

        setSnapshot(nextSnapshot);
        setSelectedCommit(nextSelectedCommit);
        setSelectedFile(nextSelectedFile);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Repository load failed.";
        setErrorMessage(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadRepository();

    return () => {
      cancelled = true;
    };
  }, [repositoryReloadVersion]);

  useEffect(() => {
    return window.gitViewer.onRepositoryChanged((event) => {
      setLastRepositoryChange(event);

      if (reloadDebounceTimerRef.current !== null) {
        window.clearTimeout(reloadDebounceTimerRef.current);
      }

      reloadDebounceTimerRef.current = window.setTimeout(() => {
        setRepositoryReloadVersion((version) => version + 1);
        reloadDebounceTimerRef.current = null;
      }, REPOSITORY_RELOAD_DEBOUNCE_MS);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (reloadDebounceTimerRef.current !== null) {
        window.clearTimeout(reloadDebounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setSelectedFile(null);
    setOverlayDiff(null);
    setOverlayDiffError(null);
    setIsOverlayDiffLoading(false);
  }, [selectedCommit]);

  useEffect(() => {
    let cancelled = false;

    if (selectedCommit?.type !== "commit") {
      setCommitFiles([]);
      setCommitFilesError(null);
      setIsCommitFilesLoading(false);
      return;
    }

    const commitHash = selectedCommit.hash;

    setCommitFiles([]);
    setCommitFilesError(null);
    setIsCommitFilesLoading(true);

    async function loadFiles() {
      try {
        const nextFiles = await window.gitViewer.loadCommitFiles(commitHash);

        if (cancelled) {
          return;
        }

        setCommitFiles(nextFiles);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Changed file list load failed.";
        setCommitFilesError(message);
      } finally {
        if (!cancelled) {
          setIsCommitFilesLoading(false);
        }
      }
    }

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, [selectedCommit]);

  useEffect(() => {
    if (!selectedFile) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedFile(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedFile]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedFile) {
      setOverlayDiff(null);
      setOverlayDiffError(null);
      setIsOverlayDiffLoading(false);
      return;
    }

    const nextSelectedFile = selectedFile;

    setOverlayDiff(null);
    setOverlayDiffError(null);

    setIsOverlayDiffLoading(true);

    async function loadDiff() {
      try {
        const nextDiff =
          nextSelectedFile.kind === "commit"
            ? await window.gitViewer.loadCommitDiff(nextSelectedFile.commitHash, nextSelectedFile.path)
            : await window.gitViewer.loadWipDiff(
                nextSelectedFile.kind,
                nextSelectedFile.path,
                nextSelectedFile.status,
              );

        if (cancelled) {
          return;
        }

        setOverlayDiff(nextDiff);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Diff load failed.";
        setOverlayDiffError(message);
      } finally {
        if (!cancelled) {
          setIsOverlayDiffLoading(false);
        }
      }
    }

    void loadDiff();

    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  const laneEntries = useMemo(
    () => (snapshot ? assignLanes(snapshot.commits) : []),
    [snapshot],
  );
  const refGroups = useMemo(
    () => splitRefs(snapshot?.branchData.refs ?? []),
    [snapshot],
  );
  const currentBranch =
    refGroups.local.find((ref) => ref.isHead) ??
    refGroups.local[0] ??
    refGroups.remote[0] ??
    null;
  const repositoryLabel = snapshot ? lastPathSegment(snapshot.repositoryPath) : "repo-a";
  const selectedNode =
    selectedCommit?.type === "commit"
      ? snapshot?.commits.find((commit) => commit.hash === selectedCommit.hash) ?? null
      : null;
  const hasWip = snapshot ? hasWipChanges(snapshot) : false;
  const commitMessageParts = splitCommitMessage(selectedNode?.message ?? "");

  return (
    <main className="desktop-shell">
      <section className="app-tabbar" aria-label="Repository tabs">
        <button className="app-tab app-tab-active" type="button">
          {repositoryLabel}
          <span className="app-tab-close" aria-hidden="true">
            ×
          </span>
        </button>
        <button className="app-tab app-tab-add" type="button" aria-label="Add repository tab">
          +
        </button>
      </section>

      <section className="app-toolbar" aria-label="Repository toolbar">
        <div className="app-toolbar-path">
          <span className="app-toolbar-badge">{repositoryLabel}</span>
          <span className="app-toolbar-separator">›</span>
          <span className="app-toolbar-branch">{currentBranch?.name ?? "detached"}</span>
        </div>
        <div className="app-toolbar-meta">
          {snapshot ? `${snapshot.commits.length} commits · ${refSummary(snapshot.branchData.refs)}` : "loading"}
        </div>
      </section>

      <section className="app-main">
        <div className="app-workspace">
          <aside className="app-pane app-pane-left" aria-label="Branch tree">
            <div className="pane-header">
              <span>左ペイン</span>
            </div>
            <div className="pane-body branch-tree">
              <section className="branch-section">
                <p className="branch-section-title">LOCAL</p>
                <ul className="branch-list">
                  {refGroups.local.map((ref) => (
                    <li key={ref.fullName} className={`branch-item${ref.isHead ? " branch-item-active" : ""}`}>
                      <span className="branch-marker">{ref.isHead ? "✓" : ""}</span>
                      <span>{ref.name}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="branch-section">
                <p className="branch-section-title">REMOTE</p>
                <ul className="branch-list">
                  {refGroups.remote.map((ref) => (
                    <li key={ref.fullName} className="branch-item">
                      <span className="branch-marker" />
                      <span>{ref.name}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="branch-section">
                <p className="branch-section-title">WORKTREES</p>
                <ul className="branch-list">
                  <li className="branch-item">
                    <span className="branch-marker" />
                    <span>{currentBranch?.name ?? repositoryLabel}</span>
                  </li>
                </ul>
              </section>
            </div>
          </aside>

          <section className="app-pane app-pane-center" aria-label="Main view">
            <div className="pane-header pane-header-grid">
              <span>BRANCH/TAG</span>
              <span>GRAPH</span>
              <span>COMMIT MESSAGE</span>
            </div>
            <div className="pane-body pane-body-center">
              {isLoading ? (
                <div className="app-empty-state">
                  <p className="selection-title">Loading commit graph</p>
                  <p className="selection-meta">main / preload / renderer の配線を確認しています。</p>
                </div>
              ) : errorMessage ? (
                <div className="app-empty-state">
                  <p className="selection-title">Cannot show commit graph</p>
                  <p className="selection-meta">{errorMessage}</p>
                </div>
              ) : snapshot && selectedCommit ? (
                <DagView
                  commits={snapshot.commits}
                  laneEntries={laneEntries}
                  wip={hasWip ? snapshot.wip : undefined}
                  selectedCommit={selectedCommit}
                  onSelectCommit={setSelectedCommit}
                />
              ) : (
                <div className="app-empty-state">
                  <p className="selection-title">No commits found</p>
                  <p className="selection-meta">対象リポジトリに commit history がまだありません。</p>
                </div>
              )}
            </div>
          </section>

          {selectedFile ? (
            <section className="diff-overlay" aria-label="Diff overlay">
              <div className="diff-overlay-header">
                <div>
                  <p className="diff-overlay-title">{selectedFile.path}</p>
                  <p className="diff-overlay-meta">
                    {selectedFile.kind === "commit"
                      ? "commit diff · left + center overlay · Esc to close"
                      : `${selectedFile.kind} diff · left + center overlay · Esc to close`}
                  </p>
                </div>
                <button className="selection-action" type="button" onClick={() => setSelectedFile(null)}>
                  Close
                </button>
              </div>
              {isOverlayDiffLoading ? (
                <div className="app-empty-state">
                  <p className="selection-title">Loading diff</p>
                  <p className="selection-meta">選択ファイルの差分を取得しています。</p>
                </div>
              ) : overlayDiffError ? (
                <div className="app-empty-state">
                  <p className="selection-title">Cannot show diff</p>
                  <p className="selection-meta">{overlayDiffError}</p>
                </div>
              ) : overlayDiff ? (
                <DiffView diff={overlayDiff} />
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className="app-pane app-pane-right" aria-label="Commit details">
          <div className="pane-header">
            <span>右ペイン</span>
          </div>

          {isLoading ? (
            <div className="pane-body right-pane-body">
              <p className="selection-title">Loading repository</p>
              <p className="selection-meta">main process から commit graph を取得しています。</p>
            </div>
          ) : errorMessage ? (
            <div className="pane-body right-pane-body">
              <p className="selection-title">Repository load failed</p>
              <p className="selection-meta">{errorMessage}</p>
            </div>
          ) : selectedCommit?.type === "wip" && snapshot ? (
            <div className="right-pane-split right-pane-split-wip">
              <FileListSection
                title="Unstaged"
                files={snapshot.wip.unstaged}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
                kind="unstaged"
                emptyMessage="未ステージの変更はありません。"
              />
              <FileListSection
                title="Staged"
                files={snapshot.wip.staged}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
                kind="staged"
                emptyMessage="ステージ済みの変更はありません。"
              />
            </div>
          ) : selectedNode ? (
            <div className="right-pane-split right-pane-split-commit">
              <section className="right-pane-message">
                <div className="right-pane-scroll-area">
                  <p className="commit-subject">{commitMessageParts.subject}</p>
                  {commitMessageParts.body ? <pre className="commit-body">{commitMessageParts.body}</pre> : null}
                </div>
              </section>
              <section className="right-pane-meta-strip">
                <p className="right-pane-meta-line">
                  <span>{selectedNode.author}</span>
                  <span>{selectedNode.date}</span>
                </p>
                <code className="right-pane-code">{selectedNode.hash}</code>
              </section>
              <FileListSection
                title="Changed files"
                files={commitFiles}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
                kind="commit"
                commitHash={selectedNode.hash}
                isLoading={isCommitFilesLoading}
                emptyMessage={commitFilesError ?? "このコミットには表示対象の変更ファイルがありません。"}
              />
            </div>
          ) : (
            <div className="pane-body right-pane-body">
              <p className="selection-title">No selection</p>
              <p className="selection-meta">コミットがまだ取得できていないか、履歴が空です。</p>
            </div>
          )}
        </aside>
      </section>

      <section className="app-statusbar" aria-label="Status bar">
        <span>{snapshot ? snapshot.repositoryPath : "No repository loaded"}</span>
        <span>{currentBranch ? `branch ${currentBranch.name}` : "branch detached"}</span>
        <span>{formatRepositoryChange(lastRepositoryChange)}</span>
      </section>
    </main>
  );
}
