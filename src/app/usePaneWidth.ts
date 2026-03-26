import { useEffect, useRef, useState } from "react";

const PANE_RESIZE_HANDLE_SIZE_PX = 12;
const LEFT_PANE_DEFAULT_WIDTH_PX = 220;
const LEFT_PANE_MIN_WIDTH_PX = 180;
const LEFT_PANE_MAX_WIDTH_PX = 360;
const RIGHT_PANE_DEFAULT_WIDTH_PX = 320;
const RIGHT_PANE_MIN_WIDTH_PX = 260;
const RIGHT_PANE_MAX_WIDTH_PX = 520;
const WORKSPACE_MIN_WIDTH_PX = 480;
const CENTER_PANE_MIN_WIDTH_PX = 420;

type DragTarget = "left" | "right";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resolveRightPaneWidth(containerWidth: number, desiredWidth: number) {
  const maxWidth = Math.min(
    RIGHT_PANE_MAX_WIDTH_PX,
    containerWidth - PANE_RESIZE_HANDLE_SIZE_PX - WORKSPACE_MIN_WIDTH_PX,
  );

  if (maxWidth <= RIGHT_PANE_MIN_WIDTH_PX) {
    return Math.max(0, maxWidth);
  }

  return clamp(desiredWidth, RIGHT_PANE_MIN_WIDTH_PX, maxWidth);
}

function resolveLeftPaneWidth(containerWidth: number, desiredWidth: number) {
  const maxWidth = Math.min(
    LEFT_PANE_MAX_WIDTH_PX,
    containerWidth - PANE_RESIZE_HANDLE_SIZE_PX - CENTER_PANE_MIN_WIDTH_PX,
  );

  if (maxWidth <= LEFT_PANE_MIN_WIDTH_PX) {
    return Math.max(0, maxWidth);
  }

  return clamp(desiredWidth, LEFT_PANE_MIN_WIDTH_PX, maxWidth);
}

export function usePaneWidth() {
  const appMainRef = useRef<HTMLElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [leftPaneWidth, setLeftPaneWidth] = useState(LEFT_PANE_DEFAULT_WIDTH_PX);
  const [rightPaneWidth, setRightPaneWidth] = useState(RIGHT_PANE_DEFAULT_WIDTH_PX);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);

  useEffect(() => {
    if (!dragTarget) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      if (dragTarget === "left") {
        const workspace = workspaceRef.current;

        if (!workspace) {
          return;
        }

        const workspaceRect = workspace.getBoundingClientRect();
        const desiredWidth = event.clientX - workspaceRect.left - PANE_RESIZE_HANDLE_SIZE_PX / 2;

        setLeftPaneWidth(resolveLeftPaneWidth(workspaceRect.width, desiredWidth));
        return;
      }

      const container = appMainRef.current;

      if (!container) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const desiredWidth = containerRect.right - event.clientX - PANE_RESIZE_HANDLE_SIZE_PX / 2;

      setRightPaneWidth(resolveRightPaneWidth(containerRect.width, desiredWidth));
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

  return {
    appMainRef,
    workspaceRef,
    appMainGridTemplateColumns: `minmax(0, 1fr) ${PANE_RESIZE_HANDLE_SIZE_PX}px minmax(${RIGHT_PANE_MIN_WIDTH_PX}px, ${rightPaneWidth}px)`,
    workspaceGridTemplateColumns: `minmax(${LEFT_PANE_MIN_WIDTH_PX}px, ${leftPaneWidth}px) ${PANE_RESIZE_HANDLE_SIZE_PX}px minmax(0, 1fr)`,
    isLeftDragging: dragTarget === "left",
    isRightDragging: dragTarget === "right",
    startLeftDragging(event: React.PointerEvent<HTMLButtonElement>) {
      event.preventDefault();
      setDragTarget("left");
    },
    startRightDragging(event: React.PointerEvent<HTMLButtonElement>) {
      event.preventDefault();
      setDragTarget("right");
    },
  };
}
