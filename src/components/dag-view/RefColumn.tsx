import type { CommitNode, Ref, SelectedCommit, WipState } from "../../types/git";
import { ROW_HEIGHT } from "./dag-view-constants";

type RefColumnProps = {
  commits: CommitNode[];
  wip?: WipState;
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
  wip,
  selectedCommit,
  onSelectCommit,
}: RefColumnProps) {
  return (
    <div className="ref-column" style={{ height: (commits.length + (wip ? 1 : 0)) * ROW_HEIGHT }}>
      {wip ? (
        <button
          className={`ref-row ref-row-wip${selectedCommit.type === "wip" ? " ref-row-selected" : ""}`}
          type="button"
          style={{ height: ROW_HEIGHT }}
          onClick={() => onSelectCommit({ type: "wip" })}
          aria-label="Select working tree changes"
        >
          <span className="ref-list" />
        </button>
      ) : null}
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
