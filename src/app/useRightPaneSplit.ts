import { useEffect, useRef, useState } from "react";

const SPLIT_HANDLE_SIZE_PX = 12;
const COMMIT_MESSAGE_MIN_PX = 160;
const COMMIT_FILES_MIN_PX = 180;
const WIP_SECTION_MIN_PX = 180;
const DEFAULT_COMMIT_RATIO = 0.56;
const DEFAULT_WIP_RATIO = 0.5;

type DragTarget = "commit" | "wip";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveRatio(
  availableHeight: number,
  desiredTopHeight: number,
  minTopHeight: number,
  minBottomHeight: number,
  fallbackRatio: number,
) {
  if (availableHeight <= 0) {
    return fallbackRatio;
  }

  const maxTopHeight = availableHeight - minBottomHeight;

  if (maxTopHeight <= minTopHeight) {
    const minimumTotal = minTopHeight + minBottomHeight;
    return minimumTotal > 0 ? minTopHeight / minimumTotal : fallbackRatio;
  }

  const topHeight = clamp(desiredTopHeight, minTopHeight, maxTopHeight);

  return clamp(topHeight / availableHeight, 0.1, 0.9);
}

export function useRightPaneSplit() {
  const commitContainerRef = useRef<HTMLDivElement | null>(null);
  const commitMetaRef = useRef<HTMLElement | null>(null);
  const wipContainerRef = useRef<HTMLDivElement | null>(null);
  const [commitRatio, setCommitRatio] = useState(DEFAULT_COMMIT_RATIO);
  const [wipRatio, setWipRatio] = useState(DEFAULT_WIP_RATIO);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);

  useEffect(() => {
    if (!dragTarget) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      if (dragTarget === "commit") {
        const container = commitContainerRef.current;
        const meta = commitMetaRef.current;

        if (!container) {
          return;
        }

        const containerRect = container.getBoundingClientRect();
        const metaHeight = meta?.getBoundingClientRect().height ?? 58;
        const availableHeight = containerRect.height - metaHeight - SPLIT_HANDLE_SIZE_PX;
        const desiredTopHeight =
          event.clientY - containerRect.top - metaHeight - SPLIT_HANDLE_SIZE_PX / 2;

        setCommitRatio(
          resolveRatio(
            availableHeight,
            desiredTopHeight,
            COMMIT_MESSAGE_MIN_PX,
            COMMIT_FILES_MIN_PX,
            DEFAULT_COMMIT_RATIO,
          ),
        );

        return;
      }

      const container = wipContainerRef.current;

      if (!container) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const availableHeight = containerRect.height - SPLIT_HANDLE_SIZE_PX;
      const desiredTopHeight = event.clientY - containerRect.top - SPLIT_HANDLE_SIZE_PX / 2;

      setWipRatio(
        resolveRatio(
          availableHeight,
          desiredTopHeight,
          WIP_SECTION_MIN_PX,
          WIP_SECTION_MIN_PX,
          DEFAULT_WIP_RATIO,
        ),
      );
    }

    function stopDragging() {
      setDragTarget(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [dragTarget]);

  const commitGridTemplateRows = `minmax(${COMMIT_MESSAGE_MIN_PX}px, ${commitRatio}fr) auto ${SPLIT_HANDLE_SIZE_PX}px minmax(${COMMIT_FILES_MIN_PX}px, ${1 - commitRatio}fr)`;
  const wipGridTemplateRows = `minmax(${WIP_SECTION_MIN_PX}px, ${wipRatio}fr) ${SPLIT_HANDLE_SIZE_PX}px minmax(${WIP_SECTION_MIN_PX}px, ${1 - wipRatio}fr)`;

  return {
    commitContainerRef,
    commitMetaRef,
    wipContainerRef,
    commitGridTemplateRows,
    wipGridTemplateRows,
    isCommitDragging: dragTarget === "commit",
    isWipDragging: dragTarget === "wip",
    startCommitDrag(event: React.PointerEvent<HTMLButtonElement>) {
      event.preventDefault();
      setDragTarget("commit");
    },
    startWipDrag(event: React.PointerEvent<HTMLButtonElement>) {
      event.preventDefault();
      setDragTarget("wip");
    },
  };
}
