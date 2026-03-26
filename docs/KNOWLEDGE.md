# KNOWLEDGE

## CSS 変更がホットリロードで画面に反映されないことがある

- 現在の Electron + `electron-vite` の開発環境では、`hmr update /src/styles/global.css` と表示されても、起動中のウィンドウに見た目の変更が反映されないことがある。
- この場合の実用上の対処は、アプリをいったん終了して `npm run dev` をやり直すこと。
- `npm run build` 自体が本質的な解決ではなく、Electron プロセスの再起動で反映される。
