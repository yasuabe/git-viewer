# ADR-008: Electron アーキテクチャと IPC 境界

- **ステータス**: 決定済み
- **決定日**: 2026-03-25
- **決定者**: yasuabe2613

---

## コンテキスト

フェーズ0では DAG view / Diff view を Vite 上の workbench で個別に試作してきた。一方、フェーズ1ではリポジトリ選択、commit 一覧取得、diff 取得などのために、ローカルの git リポジトリとファイルシステムへアクセスする必要がある。

技術スタックとして Electron と `simple-git` は既に採用済みであるが、次の点は未決定だった。

1. main process / preload / renderer の責務をどう分けるか
2. `simple-git` とファイルシステムアクセスをどのプロセスに置くか
3. renderer に何をどう公開するか
4. Electron と Vite のビルド構成をどうするか

本アプリは閲覧専用 Git GUI であり、renderer に Node.js 権限を広く渡す必要はない。責務境界を早い段階で固定し、今後の UI 実装とデータ取得実装を分離できるようにする。

---

## 決定

### 1. Git とファイルシステムアクセスは main process に集約する

Electron の main process を、本体アプリケーションのホスト兼バックエンドとして扱う。

main process の責務は次の通りとする。

- BrowserWindow の生成とライフサイクル管理
- アプリケーション全体の起動・終了制御
- リポジトリ選択ダイアログ
- `simple-git` を用いた git 情報取得
- ローカルファイルシステムアクセス
- renderer からの IPC リクエスト処理

renderer から `simple-git` や Node.js API を直接呼び出させない。

### 2. preload は薄い IPC 境界層とする

preload script は `contextBridge` を使い、renderer に必要最小限の API だけを公開する。

preload の責務は次の通りとする。

- `ipcRenderer` をラップした型付き API の公開
- renderer に不要な Electron / Node.js API を隠蔽すること

preload 自体にはアプリケーション固有のロジックを極力置かず、main と renderer の橋渡しに留める。

### 3. renderer は UI とアプリ状態に専念する

renderer process は React アプリケーションとして扱い、責務を次に限定する。

- DAG view / Diff view / 各種ペインの描画
- タブ状態、選択状態、ロード状態などの UI 状態管理
- preload 経由で公開された API の呼び出し

renderer は Node.js 権限を前提にせず、git やファイルシステムの詳細を知らない構成にする。

### 4. IPC は request-response を基本とする

フェーズ1の IPC は `ipcMain.handle` / `ipcRenderer.invoke` を基本とする。

まずは次のような request-response 型 API を想定する。

- リポジトリ選択
- リポジトリのコミット一覧取得
- commit diff 取得
- working tree diff 取得

進捗通知や購読型イベントが必要になった場合のみ、後続で event ベースの IPC を追加する。

### 5. Electron の本体構成には `electron-vite` を採用する

Electron アプリの本体構成には `electron-vite` を採用する。

構成上は次の 3 層を持つ前提とする。

- main process 用コード
- preload 用コード
- renderer 用コード

既存の `src/components/` 配下の UI コンポーネントは renderer から再利用する。

### 6. workbench と本体の起動系は分離する

workbench は引き続きブラウザ上の単体検証環境として維持し、本体の Electron 起動系とは混在させない。

- workbench: `vite.workbench-*.config.ts`
- 本体: Electron 用の構成

これにより、試作の独立性を保ちながら、本体は Electron 前提の構造へ移行できる。

---

## 理由

### セキュリティ境界を明確にするため

renderer に Node.js 権限や `simple-git` を直接渡すと、UI 層とローカル実行権限の境界が曖昧になる。main に集約し preload を薄い橋渡しに限定することで、Electron で一般的かつ安全な構成に寄せられる。

### UI 実装とデータ取得実装を分離するため

DAG view / Diff view は既に workbench で先行実装している。renderer を UI 専用に保つことで、既存コンポーネントを Electron 本体へ持ち込みやすくなる。

### フェーズ1で必要な機能に対して十分に単純なため

フェーズ1で必要なのは、ローカルリポジトリに対する同期的な問い合わせが中心である。まずは request-response IPC だけで十分であり、イベント駆動設計を先回りして導入する必要はない。

### 既存の Vite ベース開発と接続しやすいため

`electron-vite` は main / preload / renderer を Vite 系の構成で扱えるため、既存の renderer 資産や開発フローと親和性が高い。workbench とも役割分担しやすい。

---

## 影響・トレードオフ

| 観点 | 内容 |
|---|---|
| セキュリティ | renderer に Node.js 権限を直接持たせないため、境界は明確になる |
| 実装コスト | preload と IPC 層の実装が増えるが、責務分離の代償として許容する |
| UI 再利用 | `src/components/` の DAG / Diff を renderer から再利用しやすい |
| 拡張性 | 初期は request-response で単純に保ち、必要時のみ event IPC を追加できる |
| 開発環境 | workbench と本体起動系が分かれるため設定ファイルは増える |
| ビルド依存 | Electron 本体構成を `electron-vite` に寄せるため、Vite 単独の構成より依存が 1 つ増える |
