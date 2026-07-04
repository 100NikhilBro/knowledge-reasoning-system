export const CONSTRAINTS = [

  `
  CREATE CONSTRAINT proposal_id IF NOT EXISTS
  FOR (n:Proposal)
  REQUIRE n.id IS UNIQUE
  `,

  `
  CREATE CONSTRAINT author_id IF NOT EXISTS
  FOR (n:Author)
  REQUIRE n.id IS UNIQUE
  `,

  `
  CREATE CONSTRAINT feature_id IF NOT EXISTS
  FOR (n:Feature)
  REQUIRE n.id IS UNIQUE
  `,

  `
  CREATE CONSTRAINT concern_id IF NOT EXISTS
  FOR (n:Concern)
  REQUIRE n.id IS UNIQUE
  `

];