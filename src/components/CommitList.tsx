import type { CommitNode, LaneEntry, SelectedCommit } from "../types/git";
import { ROW_HEIGHT } from "./dag-view-constants";

type CommitListProps = {
  commits: CommitNode[];
  laneEntries: LaneEntry[];
  selectedCommit: SelectedCommit;
  onSelectCommit: (selectedCommit: SelectedCommit) => void;
};

export function CommitList({
  commits,
  laneEntries,
  selectedCommit,
  onSelectCommit,
}: CommitListProps) {
  return (
    <div className="commit-list" style={{ height: commits.length * ROW_HEIGHT }}>
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
          >
            <span
              className="lane-swatch"
              style={{ backgroundColor: laneEntry.color }}
              aria-hidden="true"
            />
            <span className="commit-message-group">
              <span className="commit-message">{commit.message}</span>
            </span>
            <span className="commit-meta">
              <span>{commit.author}</span>
              <span>{commit.date}</span>
              <code>{commit.hash}</code>
            </span>
          </button>
        );
      })}
    </div>
  );
}
