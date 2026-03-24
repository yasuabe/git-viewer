# ADR-009: Git データ取得と正規化方針

- **ステータス**: 決定済み
- **決定日**: 2026-03-25
- **決定者**: yasuabe2613

---

## コンテキスト

フェーズ1では Electron main process から `simple-git` を使って、実際の Git リポジトリを読み出す必要がある。

既存 ADR では次までは決まっている。

- コミット順序は `git log --topo-order --date-order` に委ねる
- モデル層は git の生データを保持し、プレゼンテーション層がレーンを計算する
- 本体では `simple-git` とファイルシステムアクセスを main process に集約する

一方、次の点は未決定だった。

1. `simple-git` から `CommitNode[]` をどう機械的に生成するか
2. refs を `git log --decorate` で取るか、別コマンドで取るか
3. `WipState` をどの git コマンドから生成するか
4. `BranchData` の生データ型と取得元をどう定義するか

ここが曖昧なままだと、main process 側の Git adapter 実装と renderer 側のモデル型の境界がぶれる。

---

## 決定

### 1. commit 本体は `git log` の機械可読フォーマットで取得する

`CommitNode[]` の元データは `git log --topo-order --date-order` を使って取得する。

`--format` には人間向け装飾を含めず、機械可読な区切り文字を明示したフォーマットを使う。

例:

```text
git log --topo-order --date-order --format=%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1e
```

各フィールドは次の意味を持つ。

- `%H`: commit hash
- `%P`: 親 commit hash 群
- `%an`: author 名
- `%aI`: strict ISO 8601 形式の author date
- `%s`: subject 行

区切り文字は次を使う。

- フィールド区切り: `0x1f` (`unit separator`)
- レコード区切り: `0x1e` (`record separator`)

アプリ側ではこの出力をパースして `CommitNode` の `hash` / `parents` / `author` / `date` / `message` を構成する。

### 2. refs は `git for-each-ref` で別取得し、commit に join する

`CommitNode.refs` は `git log --decorate` の文字列パースでは生成しない。

refs は `git for-each-ref` で別取得し、`target hash -> refs[]` のマップを作って commit データに join する。

対象は少なくとも次とする。

- `refs/heads`
- `refs/remotes`
- `refs/tags`

これにより、refs の取得は表示用装飾文字列に依存せず、機械可読に保てる。

### 3. `BranchData` は refs 生データを保持するモデルとする

`BranchData` はプレゼンテーション用のレーン情報ではなく、Git の refs 生データを保持するモデルとする。

最低限、各ブランチについて次の情報を持つ前提とする。

- `name`
- `fullName`
- `kind` (`local` / `remote` / `tag`)
- `targetHash`
- `isHead`

必要に応じて後続で upstream や worktree 情報を追加できるようにする。

`BranchData` は `git for-each-ref` の結果を正規化して生成する。

### 4. `WipState` は `git status --porcelain` を正とする

working tree の未コミット変更は `git status --porcelain` を正として取得する。

フェーズ1では `git diff --name-status` を主取得元にはしない。

理由は次の通り。

- staged / unstaged を 1 回の取得で判定しやすい
- rename を含む状態表現をまとめて扱いやすい
- UI に必要なのは差分本文ではなく、まずファイル一覧だから

`WipState` は porcelain の XY ステータスをもとに、次の 2 系統へ分解して生成する。

- `staged`
- `unstaged`

各要素は `path` と `status` を持つ。

### 5. commit diff と WIP diff の本文取得は別責務に分ける

`CommitNode[]` / `BranchData` / `WipState` の取得と、diff 本文の取得は別 API として扱う。

- commit 一覧や branch 一覧は軽量メタデータ取得
- diff 本文は選択時に個別取得

これにより、初回ロードで不要な diff 文字列を大量に持ち込まない。

---

## 理由

### `git log --decorate` の文字列パースを避けるため

`--decorate` は人間向け表示としては便利だが、ref 種別や表示名の扱いが装飾文字列依存になる。`for-each-ref` で別取得して join した方が、モデル層を git の生データに近く保てる。

### commit 本体と refs を分けた方が責務が明確なため

`git log` は commit の線形列取得に強く、`for-each-ref` は refs 取得に強い。それぞれの責務に合わせて取得元を分けた方が、制御層の実装が素直になる。

### `git status --porcelain` が WIP 一覧に直接対応するため

フェーズ1でまず必要なのは「どのファイルが staged / unstaged か」という情報であり、本文 diff ではない。porcelain 出力の方が、一覧構築には適している。

### renderer 側のモデルを安定させるため

main process 側で Git の生出力を正規化し、renderer には `CommitNode[]` / `BranchData` / `WipState` だけを渡す構成にすると、UI 実装は Git コマンドの詳細から切り離される。

---

## 影響・トレードオフ

| 観点 | 内容 |
|---|---|
| 実装の単純さ | `git log` / `for-each-ref` / `git status --porcelain` に責務を分けるため、各パーサは単純になる |
| コマンド回数 | 1 回の複合コマンドではなく複数回の git 呼び出しになるが、可読性と保守性を優先する |
| refs の正確性 | `--decorate` 文字列パースより堅牢になる |
| `BranchData` の将来拡張 | 初期型は最小限だが、upstream や worktree 情報を後から足しやすい |
| WIP 情報 | 初期はファイル一覧の取得に最適化し、本文 diff は別 API に分離する |
