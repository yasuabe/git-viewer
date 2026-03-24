export type DiffViewData = {
  raw: string;
};

export type DiffScenario = {
  id: string;
  label: string;
  description: string;
  diff: DiffViewData;
};
