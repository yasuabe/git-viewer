# Git Viewer

閲覧専用の Git GUI クライアント。コミットグラフ（DAG）をカラフルに表示する。

## 技術スタック

- Electron + React + TypeScript
- Canvas 2D（DAG 描画）
- simple-git（git バックエンド）

## 要件

- 閲覧専用（操作機能なし）
- ダークモード
- Linux 対応
- グローバル gitignore を含む Git の ignore 設定を尊重
