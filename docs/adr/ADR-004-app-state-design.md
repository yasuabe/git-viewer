# ADR-004: アプリケーション状態設計

- **ステータス**: 決定済み
- **決定日**: 2026-03-23
- **決定者**: yasuabe2613

---

## コンテキスト

アプリケーションの状態をどのように構造化するかを決定する。
本 ADR は状態の**論理構造**を記述するものであり、具体的な実装方式（React の `useState` / `useReducer`、Zustand 等の状態管理ライブラリ、Electron メインプロセスへの配置など）は別途決定する。

---

## 決定: 状態の論理構造

```
AppState
├── activeTabIndex: number | null   # アクティブなタブのインデックス。タブが0個のとき null
└── tabs: Tab[]                     # 開いているタブ（0個以上）
    └── Tab
        ├── repoPath: string
        ├── commitData: CommitData       # モデル層: コミット生データ
        ├── branchData: BranchData       # モデル層: ブランチ生データ
        └── laneView: LaneView           # プレゼンテーション層
            ├── laneData: LaneData       # レーンデータ（加工後）
            ├── branchData: BranchData   # ブランチ情報（加工後）
            ├── scrollPosition: number   # スクロール位置
            └── selectedCommit: CommitHash | null  # 選択中コミット。未選択時は null
```

### 各要素の補足

**activeTabIndex**
タブが1つも開かれていないとき `null`。タブ切替時にこの値を更新する。

**Tab**
開いているリポジトリ1つに対応する。タブの数と `tabs` 配列の要素数は常に一致する。

**commitData / branchData（モデル層）**
`git log` および `git branch` 等から取得した生データ。ADR-003 の制御層が更新する。

**laneView（プレゼンテーション層）**
モデル層の `commitData` / `branchData` をもとにプレゼンテーション層が計算・保持する。タブごとに独立して存在するため、タブ切替時にスクロール位置と選択中コミットが復元される。

**selectedCommit**
右ペインの表示内容を決定する。`null` のとき右ペインは空。WIP ノード選択時の表現は別途設計する。

---

## トレードオフ

| 観点 | 内容 |
|---|---|
| タブ切替の復元 | 各タブが `laneView` を独立して持つため、タブ切替時にスクロール位置・選択状態が自動的に復元される |
| メモリ使用量 | 開いているタブ数分の `commitData` と `laneView` をメモリに保持する。個人開発規模のリポジトリでは問題にならない想定 |
| 実装方式 | 未決定。状態の論理構造は本 ADR の通りとし、実装方式は別途 ADR を起票する |
