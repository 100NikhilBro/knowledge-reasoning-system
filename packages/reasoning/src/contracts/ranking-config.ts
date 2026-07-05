export interface RankingConfig {

  minimumScore: number;

  weights: {

    retrieval: number;

    trust: number;

    confidence: number;

  };

}