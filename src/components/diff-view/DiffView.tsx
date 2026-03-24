import { useEffect, useRef } from "react";
import { Diff2HtmlUI } from "diff2html/lib/ui/js/diff2html-ui-base.js";
import { ColorSchemeType } from "diff2html/lib-esm/types.js";
import "diff2html/bundles/css/diff2html.min.css";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github-dark.css";
import type { DiffViewData } from "../../types/diff";

type Props = {
  diff: DiffViewData;
};

const diffConfiguration = {
  colorScheme: ColorSchemeType.DARK,
  drawFileList: false,
  fileContentToggle: false,
  highlight: false,
  matching: "lines" as const,
  outputFormat: "line-by-line" as const,
  stickyFileHeaders: false,
  synchronisedScroll: false,
};

export default function DiffView({ diff }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.innerHTML = "";

    if (!diff.raw.trim()) {
      return;
    }

    const diff2htmlUi = new Diff2HtmlUI(container, diff.raw, diffConfiguration, hljs);
    diff2htmlUi.draw();
    diff2htmlUi.highlightCode();

    return () => {
      container.innerHTML = "";
    };
  }, [diff]);

  return (
    <section className="diff-view-shell">
      <div ref={containerRef} className="diff-view-root" />
    </section>
  );
}
