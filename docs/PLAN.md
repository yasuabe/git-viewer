● ## 閲覧専用 Git Viewer 構想

  ### 背景

  既存の無料 Linux 向け Git GUI クライアントを調査したが、すべて要件を満たさなかった。

  | ツール | 脱落理由 |
  |---|---|
  | Gittyup | グローバル gitignore (`core.excludesFile`) 未対応バグ。Issue #414 が3年以上放置 |
  | Sublime Merge | ダークモードが有料($99)。設定ファイル書き換え等の回避策もなし |
  | Git Cola | UI が古い（PyQt）。機能は十分だが「美しい表示」の要件に合わない |
  | GitButler | 伝統的コミットグラフではなく Virtual Branches 中心。閲覧用途には方向性が違う |
  | GitHub Desktop | コミットグラフなし |
  | Fork / Sourcetree | Linux 非対応 |

  GitKraken は解約済み。2026-09-20 まで利用可能。

  ### 要件

  - **閲覧専用**（git/gh コマンドで操作するため、操作機能は不要）
  - 伝統的なカラフルなコミットグラフ（DAG）を美しく表示
  - ダークモード必須
  - 無料 / OSS
  - Linux 対応
  - グローバル gitignore (`core.excludesFile`) 対応

  ### 技術的メモ

  - 核心はDAGレイアウトアルゴリズム（列配置・色分け・マージ線の引き回し）
  - 既存OSSやライブラリ（gitgraph.js 等）をベースにカスタマイズするのが現実的
  - diff/blame/ファイルツリーは既存ライブラリが豊富で比較的容易
  - 技術選定（Tauri + Web / Python + Qt / Electron 等）は未決定

  ### リスク

  - グラフ描画の美しさが「GitKraken同等」に達するか不確定
  - Kaggle 等と並行して6ヶ月で完成させられるか

  ### 期限

  GitKraken を参照しながら開発できるのは 2026-09-20 まで

