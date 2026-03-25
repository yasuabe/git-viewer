import type { CommitNode, WipState } from "./git";

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

export type GitViewerApi = {
  loadDefaultRepository: () => Promise<RepositorySnapshot>;
};
