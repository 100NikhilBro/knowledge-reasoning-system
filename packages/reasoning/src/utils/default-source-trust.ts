import type {
  SourceTrust
} from "../types/source-trust.js";

export const DEFAULT_SOURCE_TRUST: SourceTrust[] = [

  {

    source: "official",

    trust: 1

  },

  {

    source: "graph",

    trust: 0.95

  },

  {

    source: "github",

    trust: 0.9

  },

  {

    source: "paper",

    trust: 0.88

  },

  {

    source: "community",

    trust: 0.75

  },

  {

    source: "blog",

    trust: 0.6

  }

];