import { CommitList } from "./CommitList";
import { GraphColumn } from "./GraphColumn";
import { RefColumn } from "./RefColumn";
import type { CommitNode, LaneEntry, SelectedCommit, WipState } from "../../types/git";

type DagViewProps = {
  commits: CommitNode[];
  laneEntries: LaneEntry[];
  wip?: WipState;
  selectedCommit: SelectedCommit;
  onSelectCommit: (selectedCommit: SelectedCommit) => void;
};

export function DagView({
  commits,
  laneEntries,
  wip,
  selectedCommit,
  onSelectCommit,
}: DagViewProps) {
  return (
    <div className="dag-view" role="grid" aria-label="Commit graph">
      <div className="dag-scroll">
        <RefColumn
          commits={commits}
          wip={wip}
          selectedCommit={selectedCommit}
          onSelectCommit={onSelectCommit}
        />
        <GraphColumn
          commits={commits}
          laneEntries={laneEntries}
          wip={wip}
          selectedCommit={selectedCommit}
          onSelectCommit={onSelectCommit}
        />
        <CommitList
          commits={commits}
          laneEntries={laneEntries}
          wip={wip}
          selectedCommit={selectedCommit}
          onSelectCommit={onSelectCommit}
        />
      </div>
    </div>
  );
}
