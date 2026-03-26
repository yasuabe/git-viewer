import { useEffect, useRef, useState } from "react";

const PANE_RESIZE_HANDLE_SIZE_PX = 12;
const RIGHT_PANE_DEFAULT_WIDTH_PX = 320;
const RIGHT_PANE_MIN_WIDTH_PX = 260;
const RIGHT_PANE_MAX_WIDTH_PX = 520;
const WORKSPACE_MIN_WIDTH_PX = 480;

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

export function usePaneWidth() {
  const containerRef = useRef<HTMLElement | null>(null);
  const [rightPaneWidth, setRightPaneWidth] = useState(RIGHT_PANE_DEFAULT_WIDTH_PX);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const desiredWidth =
        containerRect.right - event.clientX - PANE_RESIZE_HANDLE_SIZE_PX / 2;

      setRightPaneWidth(resolveRightPaneWidth(containerRect.width, desiredWidth));
    }

    function stopDragging() {
      setIsDragging(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [isDragging]);

  return {
    containerRef,
    appMainGridTemplateColumns: `minmax(0, 1fr) ${PANE_RESIZE_HANDLE_SIZE_PX}px minmax(${RIGHT_PANE_MIN_WIDTH_PX}px, ${rightPaneWidth}px)`,
    isDragging,
    startDragging(event: React.PointerEvent<HTMLButtonElement>) {
      event.preventDefault();
      setIsDragging(true);
    },
  };
}
