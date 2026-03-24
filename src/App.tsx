import { useEffect, useState } from "react";
import { DagView } from "./components/DagView";
import { dummyCommits } from "./data/dummy-commits";
import { assignLanes } from "./layout/assign-lanes";
import type { SelectedCommit } from "./types/git";

const laneEntries = assignLanes(dummyCommits);

export default function App() {
  const [selectedCommit, setSelectedCommit] = useState<SelectedCommit>({
    type: "commit",
    hash: dummyCommits[0].hash,
  });

  useEffect(() => {
    if (selectedCommit.type === "commit") {
      console.log("Selected commit:", selectedCommit.hash);
    }
  }, [selectedCommit]);

  const selectedNode =
    selectedCommit.type === "commit"
      ? dummyCommits.find((commit) => commit.hash === selectedCommit.hash) ?? null
      : null;

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Phase 0 Prototype</p>
          <h1>Git Viewer DAG Sandbox</h1>
          <p className="lede">
            ダミーデータを使って、レーン計算と DAG 表示の感触を先に詰める。
          </p>
        </div>
        <section className="selection-panel" aria-label="Selected commit">
          <p className="selection-label">Selected</p>
          {selectedNode ? (
            <>
              <p className="selection-title">{selectedNode.message}</p>
              <p className="selection-meta">
                {selectedNode.hash} · {selectedNode.author} · {selectedNode.date}
              </p>
            </>
          ) : (
            <p className="selection-title">No commit selected</p>
          )}
        </section>
      </header>

      <section className="prototype-panel">
        <DagView
          commits={dummyCommits}
          laneEntries={laneEntries}
          selectedCommit={selectedCommit}
          onSelectCommit={setSelectedCommit}
        />
      </section>
    </main>
  );
}
