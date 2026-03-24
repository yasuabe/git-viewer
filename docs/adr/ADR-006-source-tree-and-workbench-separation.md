# ADR-006: ソースツリーと Workbench の分離

- **ステータス**: 決定済み
- **決定日**: 2026-03-25
- **決定者**: yasuabe2613

---

## コンテキスト

DAG view と Diff view は、先に単体コンポーネントとして試作し、その後に本体アプリへ統合する方針を採る。

この段階で次の課題があった。

1. DAG / Diff の試作用コードをどこに置くか
2. 本体コードと試作用コードをどう分離するか
3. `vite.config.ts` を本体専用に保てるか

特に、本体成果物にはプロトタイプ用コードを一切含めたくない。また、DAG と Diff の開発用入口は同型に揃えたい。

---

## 決定

ソースツリーを次の 2 系統に分離する。

- `src/`: 本体に載るコードのみを置く
- `workbench/`: DAG / Diff の動作確認用コードを置く

構成の原則は次の通りとする。

### 1. `src/` は本体専用とする

- 本体の entry は `src/app/main.tsx`
- 共通 UI コンポーネントは `src/components/` 配下
- 共通型は `src/types/` 配下
- 本体用の `vite.config.ts` は `src/app` だけを前提とし、`workbench` を参照しない

### 2. 試作用コードは `workbench/` に分離する

- DAG の試作入口は `workbench/dag/`
- Diff の試作入口は `workbench/diff/`
- DAG / Diff はどちらも `index.html`、`main.tsx`、`App.tsx` を持つ同型構成にする
- ダミーデータや一時的な確認 UI は `workbench` 側に置く

### 3. DAG / Diff の実装本体は `src/components/` に置く

- `src/components/dag-view/`
- `src/components/diff-view/`

これらは本体 app からも workbench からも参照される再利用可能なコンポーネントとする。

### 4. Workbench 用の Vite 設定は本体設定と分ける

- 本体: `vite.config.ts`
- DAG workbench: `vite.workbench-dag.config.ts`
- Diff workbench: `vite.workbench-diff.config.ts`

これにより、本体設定ファイルに `prototype` / `workbench` / `dag` / `diff` の試作入口を混在させない。

---

## 理由

### 本体コードの境界を明確にするため

`src/` を本体専用に限定することで、「このディレクトリ以下はそのまま製品に載る」という意味が明確になる。成果物に入ってよいコードと、試作専用コードの境界が曖昧にならない。

### `vite.config.ts` を本体専用に保つため

本体のビルド設定に試作入口を混ぜると、設定ファイル自体が本体と試作の責務を跨いでしまう。workbench 用の設定を別ファイルに分離することで、本体設定は本体だけを知る状態を保てる。

### DAG と Diff を対称に扱うため

片方だけ特別な構成にすると、後で本体へ統合する際に判断コストが増える。DAG / Diff の workbench を同型に揃えることで、開発手順と運用が単純になる。

### コンポーネントの再利用性を保つため

DAG / Diff の本体実装を `src/components/` に置くことで、workbench は単なる検証用ホストとなる。本体統合時に、試作用 app から本体 app へコンポーネントをそのまま持ち込める。

---

## 影響・トレードオフ

| 観点 | 内容 |
|---|---|
| ディレクトリ数 | `workbench/` と専用 Vite 設定が増えるため、構成はやや大きくなる |
| 設定ファイル数 | Vite 設定が複数になるが、責務分離の代償として許容する |
| 本体の純度 | `src/` と `vite.config.ts` を本体専用に保てる |
| 試作の独立性 | DAG / Diff を本体に影響させず個別に起動・検証できる |
| 将来の統合 | `src/components/` の再利用で、本体 app への統合が容易になる |
