import { useEffect, useMemo, useRef } from "react";
import type { CommitNode, LaneEntry, SelectedCommit, WipState } from "../../types/git";
import { ROW_HEIGHT } from "./dag-view-constants";

const LANE_WIDTH = 18;
const NODE_RADIUS = 5;
const HORIZONTAL_PADDING = 18;
const TURN_RADIUS = 6;
const WIP_RADIUS = 8;

type GraphColumnProps = {
  commits: CommitNode[];
  laneEntries: LaneEntry[];
  wip?: WipState;
  selectedCommit: SelectedCommit;
  onSelectCommit: (selectedCommit: SelectedCommit) => void;
};

function getCommitX(lane: number): number {
  return HORIZONTAL_PADDING + lane * LANE_WIDTH;
}

function drawOrthogonalLink(
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  if (fromX === toX || fromY === toY) {
    context.lineTo(toX, toY);
    return;
  }

  const directionX = Math.sign(toX - fromX);
  const directionY = Math.sign(toY - fromY);
  const trackX = Math.max(fromX, toX);
  const radius = Math.min(
    TURN_RADIUS,
    Math.abs(toX - fromX),
    Math.abs(toY - fromY),
  );

  if (fromX === trackX) {
    context.lineTo(fromX, toY - directionY * radius);
    context.quadraticCurveTo(fromX, toY, fromX + directionX * radius, toY);
    context.lineTo(toX, toY);
    return;
  }

  context.lineTo(trackX - directionX * radius, fromY);
  context.quadraticCurveTo(trackX, fromY, trackX, fromY + directionY * radius);
  context.lineTo(trackX, toY);
}

export function GraphColumn({
  commits,
  laneEntries,
  wip,
  selectedCommit,
  onSelectCommit,
}: GraphColumnProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasWipRow = Boolean(wip);

  const laneEntryLookup = useMemo(() => {
    const lookup = new Map<string, LaneEntry>();

    laneEntries.forEach((laneEntry) => {
      lookup.set(laneEntry.hash, laneEntry);
    });

    return lookup;
  }, [laneEntries]);

  const rowLookup = useMemo(() => {
    const lookup = new Map<string, number>();

    commits.forEach((commit, index) => {
      lookup.set(commit.hash, index + (hasWipRow ? 1 : 0));
    });

    return lookup;
  }, [commits, hasWipRow]);

  const headCommitIndex = useMemo(() => {
    const explicitHeadIndex = commits.findIndex((commit) =>
      commit.refs.some((ref) => ref.type === "head"),
    );

    if (explicitHeadIndex >= 0) {
      return explicitHeadIndex;
    }

    const mainIndex = commits.findIndex((commit) =>
      commit.refs.some((ref) => ref.type === "branch" && ref.name === "main"),
    );

    return mainIndex >= 0 ? mainIndex : 0;
  }, [commits]);

  const headCommitHash = commits[headCommitIndex]?.hash;
  const laneCount = laneEntries.reduce((max, laneEntry) => Math.max(max, laneEntry.lane + 1), 1);
  const canvasWidth = laneCount * LANE_WIDTH + HORIZONTAL_PADDING * 2;
  const canvasHeight = (commits.length + (hasWipRow ? 1 : 0)) * ROW_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * devicePixelRatio;
    canvas.height = canvasHeight * devicePixelRatio;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    const selectedRow =
      selectedCommit.type === "wip"
        ? hasWipRow
          ? 0
          : undefined
        : rowLookup.get(selectedCommit.hash);

    if (selectedRow !== undefined) {
      context.fillStyle = "rgba(148, 163, 184, 0.14)";
      context.fillRect(0, selectedRow * ROW_HEIGHT, canvasWidth, ROW_HEIGHT);
    }

    laneEntries.forEach((laneEntry, rowIndex) => {
      const actualRowIndex = rowIndex + (hasWipRow ? 1 : 0);
      const fromX = getCommitX(laneEntry.lane);
      const fromY = actualRowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

      laneEntry.parentLinks.forEach((link) => {
        const parentRow = rowLookup.get(link.parentHash);

        if (parentRow === undefined) {
          return;
        }

        const toX = getCommitX(link.toLane);
        const toY = parentRow * ROW_HEIGHT + ROW_HEIGHT / 2;

        context.strokeStyle = link.color;
        context.lineWidth = 2.5;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.beginPath();
        context.moveTo(fromX, fromY);

        if (link.type === "straight") {
          context.lineTo(toX, toY);
        } else {
          drawOrthogonalLink(context, fromX, fromY, toX, toY);
        }

        context.stroke();
      });
    });

    if (hasWipRow) {
      const headLaneEntry = headCommitHash ? laneEntryLookup.get(headCommitHash) : undefined;
      const wipLane = headLaneEntry?.lane ?? 0;
      const wipX = getCommitX(wipLane);
      const wipY = ROW_HEIGHT / 2;
      const headRow = headCommitHash ? rowLookup.get(headCommitHash) : undefined;

      if (headRow !== undefined) {
        const headY = headRow * ROW_HEIGHT + ROW_HEIGHT / 2;

        context.save();
        context.strokeStyle = headLaneEntry?.color ?? "#6D8BA3";
        context.lineWidth = 2;
        context.setLineDash([3, 3]);
        context.beginPath();
        context.moveTo(wipX, wipY + WIP_RADIUS);
        context.lineTo(wipX, headY - NODE_RADIUS);
        context.stroke();
        context.restore();
      }

      context.save();
      context.strokeStyle = headLaneEntry?.color ?? "#6D8BA3";
      context.lineWidth = 2;
      context.setLineDash([2, 3]);
      context.beginPath();
      context.arc(wipX, wipY, WIP_RADIUS, 0, Math.PI * 2);
      context.stroke();
      context.restore();

      if (selectedCommit.type === "wip") {
        context.beginPath();
        context.strokeStyle = "#f8fafc";
        context.lineWidth = 2;
        context.arc(wipX, wipY, WIP_RADIUS + 4, 0, Math.PI * 2);
        context.stroke();
      }
    }

    laneEntries.forEach((laneEntry, rowIndex) => {
      const x = getCommitX(laneEntry.lane);
      const y = (rowIndex + (hasWipRow ? 1 : 0)) * ROW_HEIGHT + ROW_HEIGHT / 2;
      const isSelected =
        selectedCommit.type === "commit" && selectedCommit.hash === laneEntry.hash;

      context.beginPath();
      context.fillStyle = "#08111f";
      context.arc(x, y, NODE_RADIUS + (isSelected ? 2 : 0), 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.fillStyle = laneEntry.color;
      context.arc(x, y, NODE_RADIUS, 0, Math.PI * 2);
      context.fill();

      if (isSelected) {
        context.beginPath();
        context.strokeStyle = "#f8fafc";
        context.lineWidth = 2;
        context.arc(x, y, NODE_RADIUS + 3.5, 0, Math.PI * 2);
        context.stroke();
      }
    });
  }, [
    canvasHeight,
    canvasWidth,
    commits,
    hasWipRow,
    headCommitHash,
    headCommitIndex,
    laneEntryLookup,
    laneEntries,
    rowLookup,
    selectedCommit,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="graph-column"
      width={canvasWidth}
      height={canvasHeight}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const offsetY = event.clientY - bounds.top;
        const rowIndex = Math.max(
          0,
          Math.min(commits.length + (hasWipRow ? 1 : 0) - 1, Math.floor(offsetY / ROW_HEIGHT)),
        );

        if (hasWipRow && rowIndex === 0) {
          onSelectCommit({ type: "wip" });
          return;
        }

        const commit = commits[rowIndex - (hasWipRow ? 1 : 0)];

        onSelectCommit({ type: "commit", hash: commit.hash });
      }}
    />
  );
}
