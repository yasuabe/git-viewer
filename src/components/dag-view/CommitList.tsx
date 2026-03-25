import type { CommitNode, LaneEntry, SelectedCommit, WipState } from "../../types/git";
import { formatShortHash } from "../../app/format";
import { ROW_HEIGHT } from "./dag-view-constants";

type CommitListProps = {
  commits: CommitNode[];
  laneEntries: LaneEntry[];
  wip?: WipState;
  selectedCommit: SelectedCommit;
  onSelectCommit: (selectedCommit: SelectedCommit) => void;
};

export function CommitList({
  commits,
  laneEntries,
  wip,
  selectedCommit,
  onSelectCommit,
}: CommitListProps) {
  const wipChangeCount = wip ? wip.unstaged.length + wip.staged.length : 0;

  return (
    <div className="commit-list" style={{ height: (commits.length + (wip ? 1 : 0)) * ROW_HEIGHT }}>
      {wip ? (
        <button
          className={`commit-row commit-row-with-meta commit-row-wip${
            selectedCommit.type === "wip" ? " commit-row-selected" : ""
          }`}
          type="button"
          style={{ height: ROW_HEIGHT }}
          onClick={() => onSelectCommit({ type: "wip" })}
        >
          <span className="lane-swatch lane-swatch-hidden" aria-hidden="true" />
          <span className="commit-message-group">
            <span className="wip-row-title">// WIP</span>
          </span>
          <span className="commit-meta">
            <span className="wip-row-meta">{wipChangeCount} changes</span>
          </span>
        </button>
      ) : null}
      {commits.map((commit, index) => {
        const laneEntry = laneEntries[index];
        const isSelected =
          selectedCommit.type === "commit" && selectedCommit.hash === commit.hash;

        return (
          <button
            key={commit.hash}
            className={`commit-row${isSelected ? " commit-row-selected" : ""}`}
            type="button"
            style={{ height: ROW_HEIGHT }}
            onClick={() => onSelectCommit({ type: "commit", hash: commit.hash })}
            title={`committer: ${commit.author}\ndate: ${commit.date}\nhash: ${formatShortHash(commit.hash)}`}
          >
            <span
              className="lane-swatch"
              style={{ backgroundColor: laneEntry.color }}
              aria-hidden="true"
            />
            <span className="commit-message-group">
              <span className="commit-message">{commit.message}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
