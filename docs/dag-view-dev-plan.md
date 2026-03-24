# DAG ビュー開発計画（フェーズ0）

## 目標

ROADMAP フェーズ0 の完成基準を満たす:
- ダミーデータでグラフ描画
- コミットクリックで選択イベント発生（ハンドラはコンソール出力のみ）

---

## 描画方式: ハイブリッド

グラフ列を Canvas 2D、テキスト列を DOM (React) で描画し、横並びに配置する。

```
┌─────────────┬──────────────────────────────────┐
│  Canvas 2D  │         DOM (React)              │
│  グラフ列   │  ブランチラベル / コミットメッセージ │
│  ノード+線  │  author / date / hash            │
└─────────────┴──────────────────────────────────┘
        ↕ スクロール同期
```

### 理由

- Canvas はノード・線・色分けの自由度が高く、グラフ描画に最適
- テキストは DOM に任せることで、フォント品質・選択・コピーを確保
- ブランチラベルは CSS でスタイリング

---

## ステップ

### Step 1: プロジェクト初期化

- React + TypeScript のセットアップ（Vite）
- Electron はフェーズ0では使わない。ブラウザで検証する
- ダークモードの基本 CSS

### Step 2: データ型定義とダミーデータ

コミットとレーン情報の型を定義し、テストデータを作成する。

```typescript
// コミット生データ（モデル層相当）
type CommitNode = {
  hash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];   // 0個(initial), 1個(通常), 2個(マージ)
  refs: Ref[];         // ブランチ名・タグ
};

type Ref = {
  name: string;
  type: "branch" | "tag" | "head";
};

// レーン情報（プレゼンテーション層相当）
type LaneEntry = {
  hash: string;
  lane: number;        // このコミットが配置される列番号
  color: string;       // レーンの色
  parentLinks: ParentLink[];
};

type ParentLink = {
  parentHash: string;
  fromLane: number;
  toLane: number;
  type: "straight" | "merge";
};
```

ダミーデータは以下のシナリオを含む:
1. 一本線（連続コミット）
2. 分岐（feature ブランチの作成）
3. 並行開発（2レーン以上が同時に存在）
4. マージ（feature → main）
5. レーン再利用（マージ後に空いた列を別ブランチが使用）

### Step 3: レーン割り当てアルゴリズム

`CommitNode[]`（トポロジー順）を入力として `LaneEntry[]` を出力する純粋関数。

```typescript
function assignLanes(commits: CommitNode[]): LaneEntry[];
```

方針:
- 各ブランチの先頭コミット（refs あり）が新しいレーンを開く
- 同一ブランチのコミットは同一レーンに固定
- マージコミットで子ブランチのレーンを解放
- 解放されたレーンは次の分岐で再利用
- レーン0は main 系ブランチに予約

### Step 4: Canvas グラフ列の描画

Canvas コンポーネントを作成し、`LaneEntry[]` をもとに描画する。

描画要素:
- コミットノード: 塗りつぶし円（半径 4-5px）
- 直線エッジ: 同一レーンの縦線
- マージ/分岐エッジ: レーン間を結ぶベジェ曲線
- 選択ノード: 白枠 or 拡大で強調

定数:
- 行高さ: 24-28px（1コミット = 1行）
- レーン幅: 12-16px
- Canvas 幅: レーン数 × レーン幅 + 余白

### Step 5: DOM テキスト列の描画

React コンポーネントで各行を描画する。

各行の内容:
- ブランチラベル（あれば）: 角丸バッジ
- コミットメッセージ
- （フェーズ0では author / date / hash は省略可）

### Step 6: スクロール同期とクリック検出

- Canvas と DOM リストを同一の scroll コンテナに配置するか、スクロールイベントを同期
- Canvas 上のクリック座標 → 行番号 → 対応する CommitNode を特定
- DOM 行のクリックも同じハンドラに集約
- 選択されたコミットを `console.log` に出力

---

## フェーズ0のスコープ外

- git 連携（simple-git）
- Electron シェル
- 右ペイン（コミット詳細 / WIP 表示）
- 左ペイン（ブランチツリー）
- スクロール最適化（仮想化）
- 設定ファイル

---

## ディレクトリ構成案

```
src/
├── App.tsx
├── main.tsx
├── types/
│   └── git.ts              # CommitNode, LaneEntry 等の型定義
├── data/
│   └── dummy-commits.ts    # ダミーデータ
├── layout/
│   └── assign-lanes.ts     # レーン割り当てアルゴリズム
├── components/
│   ├── DagView.tsx          # Canvas + DOM を束ねる親コンポーネント
│   ├── GraphColumn.tsx      # Canvas グラフ列
│   └── CommitList.tsx       # DOM テキスト列
└── styles/
    └── dag-view.css
```
