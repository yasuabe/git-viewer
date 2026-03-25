import type { DiffViewData } from "./diff";
import type { CommitNode, WipFile, WipState } from "./git";

export type BranchKind = "local" | "remote" | "tag";

export type BranchRecord = {
  name: string;
  fullName: string;
  kind: BranchKind;
  targetHash: string;
  isHead: boolean;
};

export type BranchData = {
  refs: BranchRecord[];
};

export type RepositorySnapshot = {
  repositoryPath: string;
  branchData: BranchData;
  commits: CommitNode[];
  wip: WipState;
};

export type FileChangeStatus = WipFile["status"];

export type CommitFileChange = {
  path: string;
  status: FileChangeStatus;
};

export type GitViewerApi = {
  loadDefaultRepository: () => Promise<RepositorySnapshot>;
  loadCommitFiles: (commitHash: string) => Promise<CommitFileChange[]>;
  loadCommitDiff: (commitHash: string, path: string) => Promise<DiffViewData>;
};
