import { useMemo, useState } from "react";
import DiffView from "../../src/components/diff-view/DiffView";
import { diffScenarios } from "./dummy-data";

export default function App() {
  const [activeScenarioId, setActiveScenarioId] = useState(diffScenarios[0]?.id ?? "");

  const activeScenario = useMemo(
    () => diffScenarios.find((scenario) => scenario.id === activeScenarioId) ?? diffScenarios[0],
    [activeScenarioId],
  );

  if (!activeScenario) {
    return null;
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <section>
          <p className="eyebrow">Workbench / Diff</p>
          <h1>Diff View Prototype</h1>
          <p className="lede">
            `diff2html` を使ったフェーズ0の diff 本文試作。ファイル一覧や選択状態はまだ載せず、本文描画だけを確認する。
          </p>
          <div className="scenario-switcher">
            {diffScenarios.map((scenario) => (
              <button
                key={scenario.id}
                className={`scenario-chip${scenario.id === activeScenario.id ? " scenario-chip-active" : ""}`}
                onClick={() => setActiveScenarioId(scenario.id)}
                type="button"
              >
                <span className="scenario-chip-label">{scenario.label}</span>
                <span className="scenario-chip-description">{scenario.description}</span>
              </button>
            ))}
          </div>
        </section>
        <aside className="selection-panel">
          <p className="selection-label">Scenario</p>
          <h2 className="selection-title">{activeScenario.label}</h2>
          <p className="selection-meta">{activeScenario.description}</p>
        </aside>
      </header>

      <section className="prototype-panel">
        <DiffView diff={activeScenario.diff} />
      </section>
    </main>
  );
}
