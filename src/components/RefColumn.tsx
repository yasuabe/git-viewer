import type { CommitNode, Ref, SelectedCommit } from "../types/git";
import { ROW_HEIGHT } from "./dag-view-constants";

type RefColumnProps = {
  commits: CommitNode[];
  selectedCommit: SelectedCommit;
  onSelectCommit: (selectedCommit: SelectedCommit) => void;
};

function refClassName(ref: Ref): string {
  if (ref.type === "head") {
    return "ref-pill ref-pill-head";
  }

  if (ref.type === "tag") {
    return "ref-pill ref-pill-tag";
  }

  return "ref-pill ref-pill-branch";
}

export function RefColumn({
  commits,
  selectedCommit,
  onSelectCommit,
}: RefColumnProps) {
  return (
    <div className="ref-column" style={{ height: commits.length * ROW_HEIGHT }}>
      {commits.map((commit) => {
        const isSelected =
          selectedCommit.type === "commit" && selectedCommit.hash === commit.hash;

        return (
          <button
            key={commit.hash}
            className={`ref-row${isSelected ? " ref-row-selected" : ""}`}
            type="button"
            style={{ height: ROW_HEIGHT }}
            onClick={() => onSelectCommit({ type: "commit", hash: commit.hash })}
            aria-label={`Select refs for commit ${commit.hash}`}
          >
            <span className="ref-list">
              {commit.refs.map((ref) => (
                <span key={`${commit.hash}-${ref.name}`} className={refClassName(ref)}>
                  {ref.name}
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
