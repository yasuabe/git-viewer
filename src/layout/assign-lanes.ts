import type { CommitNode, LaneEntry, ParentLink } from "../types/git";

const LANE_COLORS = ["#7dd3fc", "#f472b6", "#fbbf24", "#34d399", "#c084fc", "#fb7185"];

function nextFreeLane(occupied: Set<number>): number {
  let lane = 0;

  while (occupied.has(lane)) {
    lane += 1;
  }

  return lane;
}

function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

function linkColor(fromLane: number, toLane: number): string {
  if (fromLane === toLane) {
    return laneColor(fromLane);
  }

  return laneColor(Math.max(fromLane, toLane));
}

export function assignLanes(commits: CommitNode[]): LaneEntry[] {
  const pendingAssignments = new Map<string, number>();

  return commits.map((commit) => {
    const currentLane =
      pendingAssignments.get(commit.hash) ?? nextFreeLane(new Set(pendingAssignments.values()));

    pendingAssignments.delete(commit.hash);

    const parentLinks: ParentLink[] = commit.parents.map((parentHash, index) => {
      const reservedLane = pendingAssignments.get(parentHash);
      const occupied = new Set<number>([currentLane, ...pendingAssignments.values()]);

      const parentLane =
        reservedLane ??
        (index === 0 ? currentLane : nextFreeLane(occupied));

      if (reservedLane === undefined) {
        pendingAssignments.set(parentHash, parentLane);
      }

      return {
        parentHash,
        fromLane: currentLane,
        toLane: parentLane,
        color: linkColor(currentLane, parentLane),
        type: currentLane === parentLane ? "straight" : "merge",
      };
    });

    return {
      hash: commit.hash,
      lane: currentLane,
      color: laneColor(currentLane),
      parentLinks,
    };
  });
}
