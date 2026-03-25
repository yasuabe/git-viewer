import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { RepositoryChangeEvent, RepositorySnapshot } from "../types/repository";
import type { SelectedCommit } from "../types/git";
import { resolveSelectedCommit } from "./selection";

const REPOSITORY_RELOAD_DEBOUNCE_MS = 300;

type UseRepositorySyncResult = {
  snapshot: RepositorySnapshot | null;
  selectedCommit: SelectedCommit | null;
  setSelectedCommit: Dispatch<SetStateAction<SelectedCommit | null>>;
  lastRepositoryChange: RepositoryChangeEvent | null;
  errorMessage: string | null;
  isLoading: boolean;
};

export function useRepositorySync(): UseRepositorySyncResult {
  const [snapshot, setSnapshot] = useState<RepositorySnapshot | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<SelectedCommit | null>(null);
  const [lastRepositoryChange, setLastRepositoryChange] = useState<RepositoryChangeEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [repositoryReloadVersion, setRepositoryReloadVersion] = useState(0);
  const selectedCommitRef = useRef<SelectedCommit | null>(null);
  const reloadDebounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    selectedCommitRef.current = selectedCommit;
  }, [selectedCommit]);

  useEffect(() => {
    let cancelled = false;

    async function loadRepository() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextSnapshot = await window.gitViewer.loadDefaultRepository();

        if (cancelled) {
          return;
        }

        const nextSelectedCommit = resolveSelectedCommit(selectedCommitRef.current, nextSnapshot);

        setSnapshot(nextSnapshot);
        setSelectedCommit(nextSelectedCommit);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Repository load failed.";
        setErrorMessage(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadRepository();

    return () => {
      cancelled = true;
    };
  }, [repositoryReloadVersion]);

  useEffect(() => {
    return window.gitViewer.onRepositoryChanged((event) => {
      setLastRepositoryChange(event);

      if (reloadDebounceTimerRef.current !== null) {
        window.clearTimeout(reloadDebounceTimerRef.current);
      }

      reloadDebounceTimerRef.current = window.setTimeout(() => {
        setRepositoryReloadVersion((version) => version + 1);
        reloadDebounceTimerRef.current = null;
      }, REPOSITORY_RELOAD_DEBOUNCE_MS);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (reloadDebounceTimerRef.current !== null) {
        window.clearTimeout(reloadDebounceTimerRef.current);
      }
    };
  }, []);

  return {
    snapshot,
    selectedCommit,
    setSelectedCommit,
    lastRepositoryChange,
    errorMessage,
    isLoading,
  };
}
