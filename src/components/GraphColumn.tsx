import { useEffect, useMemo, useRef } from "react";
import type { CommitNode, LaneEntry, SelectedCommit } from "../types/git";
import { ROW_HEIGHT } from "./dag-view-constants";

const LANE_WIDTH = 18;
const NODE_RADIUS = 5;
const HORIZONTAL_PADDING = 18;
const TURN_RADIUS = 6;

type GraphColumnProps = {
  commits: CommitNode[];
  laneEntries: LaneEntry[];
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
  const turnY = fromY + (toY - fromY) / 2;
  const radius = Math.min(
    TURN_RADIUS,
    Math.abs(toX - fromX) / 2,
    Math.abs(turnY - fromY),
    Math.abs(toY - turnY),
  );

  context.lineTo(fromX, turnY - directionY * radius);
  context.quadraticCurveTo(fromX, turnY, fromX + directionX * radius, turnY);
  context.lineTo(toX - directionX * radius, turnY);
  context.quadraticCurveTo(toX, turnY, toX, turnY + directionY * radius);
  context.lineTo(toX, toY);
}

export function GraphColumn({
  commits,
  laneEntries,
  selectedCommit,
  onSelectCommit,
}: GraphColumnProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const rowLookup = useMemo(() => {
    const lookup = new Map<string, number>();

    commits.forEach((commit, index) => {
      lookup.set(commit.hash, index);
    });

    return lookup;
  }, [commits]);

  const laneCount = laneEntries.reduce((max, laneEntry) => Math.max(max, laneEntry.lane + 1), 1);
  const canvasWidth = laneCount * LANE_WIDTH + HORIZONTAL_PADDING * 2;
  const canvasHeight = commits.length * ROW_HEIGHT;

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

    if (selectedCommit.type === "commit") {
      const selectedRow = rowLookup.get(selectedCommit.hash);

      if (selectedRow !== undefined) {
        context.fillStyle = "rgba(148, 163, 184, 0.14)";
        context.fillRect(0, selectedRow * ROW_HEIGHT, canvasWidth, ROW_HEIGHT);
      }
    }

    laneEntries.forEach((laneEntry, rowIndex) => {
      const fromX = getCommitX(laneEntry.lane);
      const fromY = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

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

    laneEntries.forEach((laneEntry, rowIndex) => {
      const x = getCommitX(laneEntry.lane);
      const y = rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
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
  }, [canvasHeight, canvasWidth, commits, laneEntries, rowLookup, selectedCommit]);

  return (
    <canvas
      ref={canvasRef}
      className="graph-column"
      width={canvasWidth}
      height={canvasHeight}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const offsetY = event.clientY - bounds.top;
        const rowIndex = Math.max(0, Math.min(commits.length - 1, Math.floor(offsetY / ROW_HEIGHT)));
        const commit = commits[rowIndex];

        onSelectCommit({ type: "commit", hash: commit.hash });
      }}
    />
  );
}
