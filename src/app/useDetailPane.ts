import { useEffect, useRef, useState } from "react";
import type { DiffViewData } from "../types/diff";
import type { CommitFileChange, RepositorySnapshot } from "../types/repository";
import type { SelectedCommit } from "../types/git";
import { resolveSelectedFile, selectedFileKey } from "./selection";
import type { SelectedFile } from "./types";

type UseDetailPaneResult = {
  selectedFile: SelectedFile | null;
  openSelectedFile: (selectedFile: SelectedFile) => void;
  closeSelectedFile: (options?: { restoreFocus?: boolean }) => void;
  commitFiles: CommitFileChange[];
  commitFilesError: string | null;
  isCommitFilesLoading: boolean;
  overlayDiff: DiffViewData | null;
  overlayDiffError: string | null;
  isOverlayDiffLoading: boolean;
};

export function useDetailPane(
  selectedCommit: SelectedCommit | null,
  snapshot: RepositorySnapshot | null,
): UseDetailPaneResult {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [commitFiles, setCommitFiles] = useState<CommitFileChange[]>([]);
  const [commitFilesError, setCommitFilesError] = useState<string | null>(null);
  const [isCommitFilesLoading, setIsCommitFilesLoading] = useState(false);
  const [overlayDiff, setOverlayDiff] = useState<DiffViewData | null>(null);
  const [overlayDiffError, setOverlayDiffError] = useState<string | null>(null);
  const [isOverlayDiffLoading, setIsOverlayDiffLoading] = useState(false);
  const selectedFileRef = useRef<SelectedFile | null>(null);
  const lastSelectedFileKeyRef = useRef<string | null>(null);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  function restoreSelectedFileFocus() {
    const key = lastSelectedFileKeyRef.current;

    if (!key) {
      return;
    }

    window.requestAnimationFrame(() => {
      const selector = `[data-file-selection-key="${CSS.escape(key)}"]`;
      const button = document.querySelector<HTMLButtonElement>(selector);
      button?.focus();
    });
  }

  function closeSelectedFile(options?: { restoreFocus?: boolean }) {
    setSelectedFile(null);

    if (options?.restoreFocus) {
      restoreSelectedFileFocus();
    }
  }

  function openSelectedFile(nextSelectedFile: SelectedFile) {
    lastSelectedFileKeyRef.current = selectedFileKey(nextSelectedFile);

    setSelectedFile((currentSelectedFile) => {
      if (currentSelectedFile && selectedFileKey(currentSelectedFile) === selectedFileKey(nextSelectedFile)) {
        restoreSelectedFileFocus();
        return null;
      }

      return nextSelectedFile;
    });
  }

  useEffect(() => {
    if (!snapshot) {
      setSelectedFile(null);
      return;
    }

    const nextSelectedFile = resolveSelectedFile(selectedFileRef.current, selectedCommit, snapshot);

    if (nextSelectedFile !== selectedFileRef.current) {
      setSelectedFile(nextSelectedFile);
    }
  }, [selectedCommit, snapshot]);

  useEffect(() => {
    let cancelled = false;

    if (selectedCommit?.type !== "commit") {
      setCommitFiles([]);
      setCommitFilesError(null);
      setIsCommitFilesLoading(false);
      return;
    }

    const commitHash = selectedCommit.hash;

    setCommitFiles([]);
    setCommitFilesError(null);
    setIsCommitFilesLoading(true);

    async function loadFiles() {
      try {
        const nextFiles = await window.gitViewer.loadCommitFiles(commitHash);

        if (cancelled) {
          return;
        }

        setCommitFiles(nextFiles);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Changed file list load failed.";
        setCommitFilesError(message);
      } finally {
        if (!cancelled) {
          setIsCommitFilesLoading(false);
        }
      }
    }

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, [selectedCommit]);

  useEffect(() => {
    if (!selectedFile) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSelectedFile({ restoreFocus: true });
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedFile]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedFile) {
      setOverlayDiff(null);
      setOverlayDiffError(null);
      setIsOverlayDiffLoading(false);
      return;
    }

    const nextSelectedFile = selectedFile;

    setOverlayDiff(null);
    setOverlayDiffError(null);
    setIsOverlayDiffLoading(true);

    async function loadDiff() {
      try {
        const nextDiff =
          nextSelectedFile.kind === "commit"
            ? await window.gitViewer.loadCommitDiff(nextSelectedFile.commitHash, nextSelectedFile.path)
            : await window.gitViewer.loadWipDiff(
                nextSelectedFile.kind,
                nextSelectedFile.path,
                nextSelectedFile.status,
              );

        if (cancelled) {
          return;
        }

        setOverlayDiff(nextDiff);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Diff load failed.";
        setOverlayDiffError(message);
      } finally {
        if (!cancelled) {
          setIsOverlayDiffLoading(false);
        }
      }
    }

    void loadDiff();

    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  return {
    selectedFile,
    openSelectedFile,
    closeSelectedFile,
    commitFiles,
    commitFilesError,
    isCommitFilesLoading,
    overlayDiff,
    overlayDiffError,
    isOverlayDiffLoading,
  };
}
