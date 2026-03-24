export type RefType = "branch" | "tag" | "head";

export type Ref = {
  name: string;
  type: RefType;
};

export type CommitNode = {
  hash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  refs: Ref[];
};

export type ParentLink = {
  parentHash: string;
  fromLane: number;
  toLane: number;
  color: string;
  type: "straight" | "merge";
};

export type LaneEntry = {
  hash: string;
  lane: number;
  color: string;
  parentLinks: ParentLink[];
};

export type SelectedCommit = { type: "commit"; hash: string } | { type: "wip" };

export type WipFile = {
  path: string;
  status: "A" | "M" | "D" | "R";
};

export type WipState = {
  unstaged: WipFile[];
  staged: WipFile[];
};

export type DummyScenario = {
  id: string;
  label: string;
  description: string;
  commits: CommitNode[];
  wip?: WipState;
};
