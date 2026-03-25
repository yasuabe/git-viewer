import { useEffect, useMemo, useState } from "react";
import { DagView } from "../components/dag-view/DagView";
import { assignLanes } from "../components/dag-view/layout/assign-lanes";
import type { BranchRecord, RepositorySnapshot } from "../types/repository";
import type { SelectedCommit, WipFile } from "../types/git";

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

function initialSelection(snapshot: RepositorySnapshot): SelectedCommit | null {
  if (snapshot.wip && (snapshot.wip.staged.length > 0 || snapshot.wip.unstaged.length > 0)) {
    return { type: "wip" };
  }

  if (snapshot.commits.length > 0) {
    return { type: "commit", hash: snapshot.commits[0].hash };
  }

  return null;
}

export default function App() {
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<SelectedCommit | null>(null);
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

        <aside className="app-pane app-pane-right" aria-label="Commit details">
          <div className="pane-header">
            <span>右ペイン（コミット選択時）</span>
          </div>
          <div className="pane-body right-pane-body">
            {isLoading ? (
              <>
                <p className="selection-title">Loading repository</p>
                <p className="selection-meta">main process から commit graph を取得しています。</p>
              </>
            ) : errorMessage ? (
              <>
                <p className="selection-title">Repository load failed</p>
                <p className="selection-meta">{errorMessage}</p>
              </>
            ) : selectedCommit?.type === "wip" && snapshot ? (
              <>
                <div className="selection-heading">
                  <p className="selection-title">Working tree changes</p>
                  {snapshot.commits[0] ? (
                    <button
                      className="selection-action"
                      type="button"
                      onClick={() => setSelectedCommit({ type: "commit", hash: snapshot.commits[0].hash })}
                    >
                      Jump to latest commit
                    </button>
                  ) : null}
                </div>
                <p className="selection-meta">
                  unstaged {snapshot.wip.unstaged.length} files · staged {snapshot.wip.staged.length} files
                </p>
                <div className="wip-grid">
                  <section>
                    <p className="wip-heading">Unstaged</p>
                    <ul className="wip-list">
                      {snapshot.wip.unstaged.map((file) => (
                        <li key={`unstaged-${file.path}`} className="wip-item">
                          <span className={statusClassName(file.status)}>{file.status}</span>
                          <code>{file.path}</code>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <p className="wip-heading">Staged</p>
                    <ul className="wip-list">
                      {snapshot.wip.staged.map((file) => (
                        <li key={`staged-${file.path}`} className="wip-item">
                          <span className={statusClassName(file.status)}>{file.status}</span>
                          <code>{file.path}</code>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </>
            ) : selectedNode ? (
              <>
                <p className="selection-title">{selectedNode.message}</p>
                <p className="selection-meta">
                  {selectedNode.author} · {selectedNode.date}
                </p>
                <div className="right-pane-section">
                  <p className="right-pane-label">Commit</p>
                  <code className="right-pane-code">{selectedNode.hash}</code>
                </div>
                <div className="right-pane-section">
                  <p className="right-pane-label">Changed files</p>
                  <p className="selection-meta">ファイル一覧は次の段階で main process から取得する。</p>
                </div>
                {hasWip ? (
                  <button className="selection-action" type="button" onClick={() => setSelectedCommit({ type: "wip" })}>
                    Open WIP
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <p className="selection-title">No selection</p>
                <p className="selection-meta">コミットがまだ取得できていないか、履歴が空です。</p>
              </>
            )}
          </div>
        </aside>
      </section>

      <section className="app-statusbar" aria-label="Status bar">
        <span>{snapshot ? snapshot.repositoryPath : "No repository loaded"}</span>
        <span>{currentBranch ? `branch ${currentBranch.name}` : "branch detached"}</span>
      </section>
    </main>
  );
}
