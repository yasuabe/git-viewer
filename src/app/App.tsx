import { useEffect, useMemo, useState } from "react";
import { DagView } from "../components/dag-view/DagView";
import { assignLanes } from "../components/dag-view/layout/assign-lanes";
import DiffView from "../components/diff-view/DiffView";
import type { BranchRecord, RepositorySnapshot } from "../types/repository";
import type { DiffViewData } from "../types/diff";
import type { SelectedCommit, WipFile } from "../types/git";

type SelectedFile = {
  kind: "commit" | "staged" | "unstaged";
  path: string;
  status?: WipFile["status"];
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

function initialSelection(snapshot: RepositorySnapshot): SelectedCommit | null {
  if (snapshot.wip && (snapshot.wip.staged.length > 0 || snapshot.wip.unstaged.length > 0)) {
    return { type: "wip" };
  }

  if (snapshot.commits.length > 0) {
    return { type: "commit", hash: snapshot.commits[0].hash };
  }

  return null;
}

function createPlaceholderDiff(selectedFile: SelectedFile): DiffViewData {
  const status = selectedFile.status ?? "M";
  const path = selectedFile.path;

  if (status === "A") {
    return {
      raw: `diff --git a/${path} b/${path}
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/${path}
@@ -0,0 +1,4 @@
+// Placeholder diff
+// path: ${path}
+// source: ${selectedFile.kind}
+export const todo = true;
`,
    };
  }

  if (status === "D") {
    return {
      raw: `diff --git a/${path} b/${path}
deleted file mode 100644
index 1111111..0000000
--- a/${path}
+++ /dev/null
@@ -1,3 +0,0 @@
-// Placeholder diff
-// path: ${path}
-export const removed = true;
`,
    };
  }

  return {
    raw: `diff --git a/${path} b/${path}
index 1111111..2222222 100644
--- a/${path}
+++ b/${path}
@@ -1,4 +1,5 @@
-// Placeholder before wiring git diff
+// Placeholder diff
+// path: ${path}
 export const source = "${selectedFile.kind}";
 export const status = "${status}";
+export const pending = true;
`,
  };
}

type FileListSectionProps = {
  title: string;
  files: WipFile[];
  selectedFile: SelectedFile | null;
  onSelectFile: (selectedFile: SelectedFile) => void;
  kind: "staged" | "unstaged";
};

function FileListSection({ title, files, selectedFile, onSelectFile, kind }: FileListSectionProps) {
  return (
    <section className="right-pane-split-section">
      <div className="right-pane-split-header">
        <p className="right-pane-label">{title}</p>
        <span className="right-pane-count">{files.length}</span>
      </div>
      <div className="right-pane-scroll-area">
        <ul className="right-pane-file-list">
          {files.map((file) => {
            const isActive = selectedFile?.path === file.path && selectedFile.kind === kind;

            return (
              <li key={`${kind}-${file.path}`}>
                <button
                  className={`right-pane-file-button${isActive ? " right-pane-file-button-active" : ""}`}
                  type="button"
                  onClick={() => onSelectFile({ kind, path: file.path, status: file.status })}
                >
                  <span className={statusClassName(file.status)}>{file.status}</span>
                  <code>{file.path}</code>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<SelectedCommit | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

        setSnapshot(nextSnapshot);
        setSelectedCommit(initialSelection(nextSnapshot));
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
  }, []);

  useEffect(() => {
    setSelectedFile(null);
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
  const hasWip = Boolean(snapshot?.wip && (snapshot.wip.staged.length > 0 || snapshot.wip.unstaged.length > 0));
  const commitMessageParts = splitCommitMessage(selectedNode?.message ?? "");
  const overlayDiff = selectedFile ? createPlaceholderDiff(selectedFile) : null;

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

          {selectedFile && overlayDiff ? (
            <section className="diff-overlay" aria-label="Diff overlay">
              <div className="diff-overlay-header">
                <div>
                  <p className="diff-overlay-title">{selectedFile.path}</p>
                  <p className="diff-overlay-meta">
                    placeholder diff · left + center overlay · Esc to close
                  </p>
                </div>
                <button className="selection-action" type="button" onClick={() => setSelectedFile(null)}>
                  Close
                </button>
              </div>
              <DiffView diff={overlayDiff} />
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
              />
              <FileListSection
                title="Staged"
                files={snapshot.wip.staged}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
                kind="staged"
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
              <section className="right-pane-split-section">
                <div className="right-pane-split-header">
                  <p className="right-pane-label">Changed files</p>
                  <span className="right-pane-count">pending</span>
                </div>
                <div className="right-pane-scroll-area right-pane-placeholder">
                  <p className="selection-meta">
                    コミットごとの変更ファイル一覧は、main process からの取得を次の段階で接続する。
                  </p>
                </div>
              </section>
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
      </section>
    </main>
  );
}
