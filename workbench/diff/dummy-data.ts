import type { DiffScenario } from "../../src/types/diff";

const graphRefactorDiff = String.raw`diff --git a/src/components/dag-view/GraphColumn.tsx b/src/components/dag-view/GraphColumn.tsx
index 34a2fd7..5d8bc77 100644
--- a/src/components/dag-view/GraphColumn.tsx
+++ b/src/components/dag-view/GraphColumn.tsx
@@ -89,9 +89,13 @@ export default function GraphColumn({
   const rowLookup = useMemo(() => {
     const lookup = new Map<string, number>();
 
-    const debugPadding = 12;
-    commits.forEach((commit, index) => lookup.set(commit.hash, index));
+    commits.forEach((commit, index) => {
+      lookup.set(commit.hash, index);
+    });
 
     return lookup;
   }, [commits]);
 
+  const headCommitHash = commits[headCommitIndex]?.hash;
   const laneCount = laneEntries.reduce((max, laneEntry) => Math.max(max, laneEntry.lane + 1), 1);
   const canvasWidth = laneCount * LANE_WIDTH + HORIZONTAL_PADDING * 2;
@@ -160,12 +164,12 @@ export default function GraphColumn({
     }
 
     if (hasWipRow) {
-      const wipLane = laneEntries[headCommitIndex]?.lane ?? 0;
+      const headLaneEntry = headCommitHash ? laneEntryLookup.get(headCommitHash) : undefined;
+      const wipLane = headLaneEntry?.lane ?? 0;
       const wipX = getCommitX(wipLane);
       const wipY = ROW_HEIGHT / 2;
-      const headRow = rowLookup.get(commits[headCommitIndex]?.hash ?? "");
+      const headRow = headCommitHash ? rowLookup.get(headCommitHash) : undefined;
 
       if (headRow !== undefined) {
         const headY = headRow * ROW_HEIGHT + ROW_HEIGHT / 2;
-        context.strokeStyle = laneEntries[headCommitIndex]?.color ?? "#7dd3fc";
+        context.strokeStyle = headLaneEntry?.color ?? "#7dd3fc";
         context.lineWidth = 2;
         context.setLineDash([3, 3]);
         context.beginPath();`;

const cssTouchUpDiff = String.raw`diff --git a/src/styles/global.css b/src/styles/global.css
index 41fbd3e..9ab1732 100644
--- a/src/styles/global.css
+++ b/src/styles/global.css
@@ -395,6 +395,24 @@ code {
 .commit-meta code {
   color: #cbd5e1;
 }
+
+.diff-view-shell {
+  min-height: 720px;
+  padding: 20px 24px 28px;
+}
+
+.diff-view-root .d2h-wrapper {
+  background: transparent;
+}
+
+.diff-view-root .d2h-file-wrapper {
+  margin-bottom: 18px;
+  border-radius: 18px;
+  overflow: hidden;
+  box-shadow: 0 16px 50px rgba(2, 6, 23, 0.3);
+}
+
+.diff-view-root .hljs {
+  background: transparent;
+}
@@ -421,6 +439,10 @@ code {
   .commit-list {
     min-width: 560px;
   }
+
+  .diff-view-shell {
+    padding-inline: 12px;
+  }
 }`;

export const diffScenarios: DiffScenario[] = [
  {
    id: "graph-refactor",
    label: "Graph Refactor Patch",
    description: "TypeScript の単一ファイル差分。行番号、削除、追加、シンタックスハイライトを見るためのケース。",
    diff: {
      raw: graphRefactorDiff,
    },
  },
  {
    id: "css-touch-up",
    label: "CSS Touch-Up Patch",
    description: "CSS 単一ファイル差分。追加範囲の塗りと行境界の見え方を確認するためのケース。",
    diff: {
      raw: cssTouchUpDiff,
    },
  },
];
