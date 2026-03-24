import type { CommitNode, LaneEntry, ParentLink } from "../../../types/git";

const LANE_COLORS = ["#7dd3fc", "#f472b6", "#fbbf24", "#34d399", "#c084fc", "#fb7185"];

function nextFreeLane(occupied: Set<number>, start = 0): number {
  let lane = start;

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

function mainlineHashes(commits: CommitNode[]): Set<string> {
  const commitByHash = new Map(commits.map((commit) => [commit.hash, commit]));
  const startCommit =
    commits.find((commit) =>
      commit.refs.some((ref) => ref.type === "branch" && ref.name === "main"),
    ) ??
    commits.find((commit) => commit.refs.some((ref) => ref.type === "head")) ??
    commits[0];

  const hashes = new Set<string>();
  let currentCommit: CommitNode | undefined = startCommit;

  while (currentCommit) {
    hashes.add(currentCommit.hash);

    const firstParentHash = currentCommit.parents[0];

    if (!firstParentHash) {
      break;
    }

    currentCommit = commitByHash.get(firstParentHash);
  }

  return hashes;
}

export function assignLanes(commits: CommitNode[]): LaneEntry[] {
  const pendingAssignments = new Map<string, number>();
  const mainHashes = mainlineHashes(commits);

  return commits.map((commit) => {
    const reservedCurrentLane = pendingAssignments.get(commit.hash);
    const occupiedLanes = new Set<number>([0, ...pendingAssignments.values()]);
    const currentLane = mainHashes.has(commit.hash)
      ? 0
      : reservedCurrentLane ?? nextFreeLane(occupiedLanes, 1);

    pendingAssignments.delete(commit.hash);

    const parentLinks: ParentLink[] = commit.parents.map((parentHash, index) => {
      const reservedLane = pendingAssignments.get(parentHash);
      const occupied = new Set<number>([0, currentLane, ...pendingAssignments.values()]);
      let parentLane: number;

      if (mainHashes.has(parentHash)) {
        parentLane = 0;
      } else if (reservedLane !== undefined) {
        parentLane = reservedLane;
      } else if (index === 0 && currentLane !== 0) {
        parentLane = currentLane;
      } else {
        parentLane = nextFreeLane(occupied, 1);
      }

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
