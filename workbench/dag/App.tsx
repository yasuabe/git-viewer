import { useEffect, useMemo, useState } from "react";
import { DagView } from "../../src/components/dag-view/DagView";
import { assignLanes } from "../../src/components/dag-view/layout/assign-lanes";
import { dummyScenarios } from "./dummy-data";
import type { DummyScenario, SelectedCommit, WipFile } from "../../src/types/git";

function initialSelectionForScenario(scenario: DummyScenario): SelectedCommit {
  if (scenario.wip) {
    return { type: "wip" };
  }

  return { type: "commit", hash: scenario.commits[0].hash };
}

function statusClassName(status: WipFile["status"]): string {
  return `wip-status wip-status-${status.toLowerCase()}`;
}

export default function App() {
  const [activeScenarioId, setActiveScenarioId] = useState(dummyScenarios[0].id);
  const activeScenario = dummyScenarios.find((scenario) => scenario.id === activeScenarioId) ?? dummyScenarios[0];
  const laneEntries = useMemo(() => assignLanes(activeScenario.commits), [activeScenario]);
  const [selectedCommit, setSelectedCommit] = useState<SelectedCommit>(
    initialSelectionForScenario(dummyScenarios[0]),
  );

  useEffect(() => {
    setSelectedCommit(initialSelectionForScenario(activeScenario));
  }, [activeScenario]);

  useEffect(() => {
    if (selectedCommit.type === "commit") {
      console.log("Selected commit:", selectedCommit.hash);
      return;
    }

    console.log("Selected WIP");
  }, [selectedCommit]);

  const selectedNode =
    selectedCommit.type === "commit"
      ? activeScenario.commits.find((commit) => commit.hash === selectedCommit.hash) ?? null
      : null;

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workbench / DAG</p>
          <h1>Git Viewer DAG Sandbox</h1>
          <p className="lede">
            ダミーデータを使って、レーン計算と DAG 表示の感触を先に詰める。
          </p>
          <div className="scenario-switcher" role="tablist" aria-label="Dummy data scenarios">
            {dummyScenarios.map((scenario) => {
              const isActive = scenario.id === activeScenario.id;

              return (
                <button
                  key={scenario.id}
                  className={`scenario-chip${isActive ? " scenario-chip-active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveScenarioId(scenario.id)}
                >
                  <span className="scenario-chip-label">{scenario.label}</span>
                  <span className="scenario-chip-description">{scenario.description}</span>
                </button>
              );
            })}
          </div>
        </div>
        <section className="selection-panel" aria-label="Selected commit">
          <p className="selection-label">Selected</p>
          {selectedCommit.type === "wip" && activeScenario.wip ? (
            <>
              <div className="selection-heading">
                <p className="selection-title">Working tree changes</p>
                <button
                  className="selection-action"
                  type="button"
                  onClick={() => setSelectedCommit({ type: "commit", hash: activeScenario.commits[0].hash })}
                >
                  Jump to latest commit
                </button>
              </div>
              <p className="selection-meta">
                unstaged {activeScenario.wip.unstaged.length} files · staged {activeScenario.wip.staged.length} files
              </p>
              <div className="wip-grid">
                <section>
                  <p className="wip-heading">Unstaged</p>
                  <ul className="wip-list">
                    {activeScenario.wip.unstaged.map((file) => (
                      <li key={`unstaged-${file.path}`} className="wip-item">
                        <span className={statusClassName(file.status)}>{file.status}</span>
                        <code>{file.path}</code>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <p className="wip-heading">Staged</p>
                  <ul className="wip-list">
                    {activeScenario.wip.staged.map((file) => (
                      <li key={`staged-${file.path}`} className="wip-item">
                        <span className={statusClassName(file.status)}>{file.status}</span>
                        <code>{file.path}</code>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          ) : selectedNode ? (
            <>
              <div className="selection-heading">
                <p className="selection-title">{selectedNode.message}</p>
                {activeScenario.wip ? (
                  <button
                    className="selection-action"
                    type="button"
                    onClick={() => setSelectedCommit({ type: "wip" })}
                  >
                    Open WIP
                  </button>
                ) : null}
              </div>
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
          commits={activeScenario.commits}
          laneEntries={laneEntries}
          wip={activeScenario.wip}
          selectedCommit={selectedCommit}
          onSelectCommit={setSelectedCommit}
        />
      </section>
    </main>
  );
}
