import { statusClassName } from "./format";
import { selectedFileKey } from "./selection";
import type { SelectedFile } from "./types";
import type { WipFile } from "../types/git";

type FileListSectionProps = {
  title: string;
  files: Array<{ path: string; status: WipFile["status"] }>;
  selectedFile: SelectedFile | null;
  onSelectFile: (selectedFile: SelectedFile) => void;
  kind: SelectedFile["kind"];
  commitHash?: string;
  isLoading?: boolean;
  emptyMessage: string;
};

export function FileListSection({
  title,
  files,
  selectedFile,
  onSelectFile,
  kind,
  commitHash,
  isLoading = false,
  emptyMessage,
}: FileListSectionProps) {
  return (
    <section className="right-pane-split-section">
      <div className="right-pane-split-header">
        <p className="right-pane-label">{title}</p>
        <span className="right-pane-count">{isLoading ? "..." : files.length}</span>
      </div>
      {isLoading ? (
        <div className="right-pane-scroll-area right-pane-placeholder">
          <p className="selection-meta">ファイル一覧を取得しています。</p>
        </div>
      ) : files.length > 0 ? (
        <div className="right-pane-scroll-area">
          <ul className="right-pane-file-list">
            {files.map((file) => {
              const nextSelectedFile =
                kind === "commit"
                  ? {
                      kind,
                      commitHash: commitHash ?? "",
                      path: file.path,
                      status: file.status,
                    }
                  : {
                      kind,
                      path: file.path,
                      status: file.status,
                    };
              const isActive =
                selectedFile?.path === file.path &&
                selectedFile.kind === kind &&
                (selectedFile.kind !== "commit" || selectedFile.commitHash === commitHash);

              return (
                <li key={`${kind}-${file.path}`}>
                  <button
                    className={`right-pane-file-button${isActive ? " right-pane-file-button-active" : ""}`}
                    type="button"
                    aria-pressed={isActive}
                    data-file-selection-key={selectedFileKey(nextSelectedFile)}
                    onClick={() => onSelectFile(nextSelectedFile)}
                  >
                    <span className={statusClassName(file.status)}>{file.status}</span>
                    <code>{file.path}</code>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="right-pane-scroll-area right-pane-placeholder">
          <p className="selection-meta">{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}
