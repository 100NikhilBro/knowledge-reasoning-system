export const INDEXES = [

  `
  CREATE INDEX proposal_title IF NOT EXISTS
  FOR (n:Proposal)
  ON (n.label)
  `,

  `
  CREATE INDEX feature_label IF NOT EXISTS
  FOR (n:Feature)
  ON (n.label)
  `,

  `
  CREATE INDEX author_label IF NOT EXISTS
  FOR (n:Author)
  ON (n.label)
  `,

  `
  CREATE INDEX concern_label IF NOT EXISTS
  FOR (n:Concern)
  ON (n.label)
  `,

  `
  CREATE INDEX decision_label IF NOT EXISTS
  FOR (n:Decision)
  ON (n.label)
  `,

  `
  CREATE INDEX python_version_label IF NOT EXISTS
  FOR (n:PythonVersion)
  ON (n.label)
  `

];
