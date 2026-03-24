# Git Viewer

閲覧専用の Git GUI クライアント。カラフルなコミットグラフ（DAG）を美しく表示する。

## 技術スタック

- Electron + React + TypeScript
- Canvas 2D（DAG 描画）
- simple-git（git バックエンド）

## 要件

- 閲覧専用（操作機能なし）
- ダークモード
- Linux 対応
- `core.excludesFile`（グローバル gitignore）対応
