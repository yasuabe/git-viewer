import { useMemo, useState } from "react";
import { DagView } from "../components/dag-view/DagView";
import { assignLanes } from "../components/dag-view/layout/assign-lanes";
import DiffView from "../components/diff-view/DiffView";
import { FileListSection } from "./FileListSection";
import {
  formatRepositoryChange,
  formatShortHash,
  lastPathSegment,
  refSummary,
  splitCommitMessage,
  splitRefs,
} from "./format";
import { hasWipChanges } from "./selection";
import { useDetailPane } from "./useDetailPane";
import { usePaneWidth } from "./usePaneWidth";
import { useRightPaneSplit } from "./useRightPaneSplit";
import { useRepositorySync } from "./useRepositorySync";

export default function App() {
  const [isLeftPaneOpen, setIsLeftPaneOpen] = useState(true);
  const {
    snapshot,
    selectedCommit,
    setSelectedCommit,
    lastRepositoryChange,
    errorMessage,
    isLoading,
  } = useRepositorySync();
  const {
    selectedFile,
    openSelectedFile,
    closeSelectedFile,
    commitFiles,
    commitFilesError,
    isCommitFilesLoading,
    overlayDiff,
    overlayDiffError,
    isOverlayDiffLoading,
  } = useDetailPane(selectedCommit, snapshot);
  const {
    commitContainerRef,
    commitMetaRef,
    wipContainerRef,
    commitGridTemplateRows,
    wipGridTemplateRows,
    isCommitDragging,
    isWipDragging,
    startCommitDrag,
    startWipDrag,
  } = useRightPaneSplit();
  const {
    appMainRef,
    workspaceRef,
    appMainGridTemplateColumns,
    workspaceGridTemplateColumns,
    isLeftDragging,
    isRightDragging,
    startLeftDragging,
    startRightDragging,
  } = usePaneWidth();

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
  const parentCommitLabel = selectedNode?.parents[0]
    ? `parent: ${formatShortHash(selectedNode.parents[0])}`
    : "initial commit";

  return (
    <main className="desktop-shell">
      <section className="app-tabbar" aria-label="Repository tabs">
        <button className="app-tab app-tab-active" type="button">
          {repositoryLabel}
          <span className="app-tab-close" aria-hidden="true">
            ×
          </span>
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

      <section ref={appMainRef} className="app-main" style={{ gridTemplateColumns: appMainGridTemplateColumns }}>
        <div
          ref={workspaceRef}
          className={`app-workspace${isLeftPaneOpen ? "" : " app-workspace-left-collapsed"}`}
          style={isLeftPaneOpen ? { gridTemplateColumns: workspaceGridTemplateColumns } : undefined}
        >
          {isLeftPaneOpen ? (
            <aside className="app-pane app-pane-left" aria-label="Branch tree">
              <div className="pane-header pane-header-left">
                <button
                  className="app-pane-toggle"
                  type="button"
                  aria-label="Hide left pane"
                  onClick={() => setIsLeftPaneOpen(false)}
                >
                  &lt;
                </button>
                <span>VIEWING 1</span>
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
          ) : (
            <aside className="app-pane app-pane-left-collapsed" aria-label="Branch tree collapsed">
              <div className="pane-header pane-header-left-collapsed">
                <button
                  className="app-pane-toggle"
                  type="button"
                  aria-label="Show left pane"
                  onClick={() => setIsLeftPaneOpen(true)}
                >
                  &gt;
                </button>
              </div>
            </aside>
          )}

          {isLeftPaneOpen ? (
            <button
              className={`app-pane-resize-handle${isLeftDragging ? " app-pane-resize-handle-dragging" : ""}`}
              type="button"
              aria-label="Resize left pane"
              onPointerDown={startLeftDragging}
            />
          ) : (
            null
          )}

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
                <p className="diff-overlay-title">{selectedFile.path}</p>
                <button
                  className="diff-overlay-close"
                  type="button"
                  aria-label="Close diff overlay"
                  onClick={() => closeSelectedFile({ restoreFocus: true })}
                >
                  ×
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

        <button
          className={`app-pane-resize-handle${isRightDragging ? " app-pane-resize-handle-dragging" : ""}`}
          type="button"
          aria-label="Resize right pane"
          onPointerDown={startRightDragging}
        />

        <aside className="app-pane app-pane-right" aria-label="Commit details">
          <div className="pane-header">
            {selectedCommit?.type === "commit" && selectedNode ? (
              <span className="pane-header-commit-label">
                <span>commit:</span>
                <code>{formatShortHash(selectedNode.hash)}</code>
              </span>
            ) : selectedCommit?.type === "wip" ? (
              <span>WIP</span>
            ) : (
              <span>右ペイン</span>
            )}
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
            <div
              ref={wipContainerRef}
              className="right-pane-split right-pane-split-wip"
              style={{ gridTemplateRows: wipGridTemplateRows }}
            >
              <FileListSection
                title="Unstaged"
                files={snapshot.wip.unstaged}
                selectedFile={selectedFile}
                onSelectFile={openSelectedFile}
                kind="unstaged"
                emptyMessage="未ステージの変更はありません。"
              />
              <button
                className={`right-pane-drag-handle${isWipDragging ? " right-pane-drag-handle-dragging" : ""}`}
                type="button"
                aria-label="Resize WIP sections"
                onPointerDown={startWipDrag}
              />
              <FileListSection
                title="Staged"
                files={snapshot.wip.staged}
                selectedFile={selectedFile}
                onSelectFile={openSelectedFile}
                kind="staged"
                emptyMessage="ステージ済みの変更はありません。"
              />
            </div>
          ) : selectedNode ? (
            <div
              ref={commitContainerRef}
              className="right-pane-split right-pane-split-commit"
              style={{ gridTemplateRows: commitGridTemplateRows }}
            >
              <section className="right-pane-message">
                <div className="right-pane-scroll-area">
                  <p className="commit-subject">{commitMessageParts.subject}</p>
                  {commitMessageParts.body ? <pre className="commit-body">{commitMessageParts.body}</pre> : null}
                </div>
              </section>
              <section ref={commitMetaRef} className="right-pane-meta-strip">
                <p className="right-pane-meta-line">
                  <span>{selectedNode.author}</span>
                  <span>{selectedNode.date}</span>
                  <span>{parentCommitLabel}</span>
                </p>
              </section>
              <button
                className={`right-pane-drag-handle${isCommitDragging ? " right-pane-drag-handle-dragging" : ""}`}
                type="button"
                aria-label="Resize commit details sections"
                onPointerDown={startCommitDrag}
              />
              <FileListSection
                title="Changed files"
                files={commitFiles}
                selectedFile={selectedFile}
                onSelectFile={openSelectedFile}
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
