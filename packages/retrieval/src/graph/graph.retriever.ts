import {
  GraphTraversalService
} from "@knowledge/graph";

import type {
  KnowledgeEntity,
  KnowledgeRelationship,
  GraphNeighbor,
  GraphSubgraph,
  GraphPath
} from "@knowledge/shared";

import {
  GraphRetriever
} from "../contracts/retriever.js";

import type {
  RetrievalQuery
} from "../types/retrieval-query.js";

import type {
  RetrievalResult
} from "../types/retrieval-result.js";

import {
  calculateScore
} from "../ranking/score.js";

/**
 * Tokens that must not keep a candidate via substring match alone
 * (e.g. "is" matching inside "Type Hints").
 */
const GRAPH_STOP_TOKENS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "of", "to", "for", "from", "in", "on", "at", "by", "with", "as",
  "about", "into", "over", "after", "before", "between", "through",
  "tell", "me", "what", "who", "whom", "whose", "which", "when", "where",
  "why", "how", "does", "did", "do", "can", "could", "should", "would",
  "will", "and", "or", "but", "not", "it", "its", "this", "that",
  "these", "those", "please", "explain", "describe", "define"
]);


export class Neo4jGraphRetriever
implements GraphRetriever {

  constructor(
    private readonly graph =
      new GraphTraversalService()
  ) {}


  async retrieve(
    query: RetrievalQuery
  ): Promise<RetrievalResult[]> {

    const candidates =
      await this.findCandidates(
        query.query
      );


    const results =
      candidates.map(
        entity => ({

          entity,

          score:
            this.calculateRelevance(
              query.query,
              entity
            ),

          source:
            "graph" as const

        })
      );


    results.sort(
      (a, b) =>
        b.score - a.score
    );


    return results.slice(
      0,
      query.topK
    );

  }


  async findCandidates(
    query: string
  ): Promise<KnowledgeEntity[]> {

    const labels = [

      "Proposal",

      "Feature",

      "Author",

      "Concern"

    ];


    const groups =
      await Promise.all(

        labels.map(
          label =>
            this.graph.findNodesByLabel(
              label
            )
        )

      );


    const entities =
      groups.flat();


    const normalizedQuery =
      this.normalize(query);


    const queryTokens =
      this.tokenize(
        normalizedQuery
      );


    return entities.filter(
      entity => {

        const searchableText =
          this.buildSearchableText(
            entity
          );


        return queryTokens.some(
          token =>
            searchableText.includes(
              token
            )
        );

      }
    );

  }


  private buildSearchableText(
    entity: KnowledgeEntity
  ): string {

    const values = [

      entity.id,

      entity.label,

      entity.source,

      ...Object.values(
        entity.properties ?? {}
      )

    ];


    return this.normalize(
      values
        .filter(
          value =>
            typeof value === "string" ||
            typeof value === "number"
        )
        .join(" ")
    );

  }


  private tokenize(
    value: string
  ): string[] {

    return value
      .split(/\s+/)
      .map(
        token =>
          token.replace(
            /[^\w-]/g,
            ""
          )
      )
      .filter(
        token =>
          token.length > 1 &&
          !GRAPH_STOP_TOKENS.has(token)
      );

  }


  private normalize(
    value: string
  ): string {

    return value
      .trim()
      .toLowerCase();

  }


  private calculateRelevance(
    query: string,
    entity: KnowledgeEntity
  ): number {

    const queryText =
      this.normalize(query);


    const searchableText =
      this.buildSearchableText(
        entity
      );


    let score =
      calculateScore(entity);


    /*
     * Exact label match
     */

    if (
      queryText.includes(
        this.normalize(
          entity.label
        )
      )
    ) {

      score += 10;

    }


    /*
     * Exact entity id match
     */

    if (
      queryText.includes(
        this.normalize(
          entity.id
        )
      )
    ) {

      score += 15;

    }


    /*
     * Token overlap
     */

    const queryTokens =
      this.tokenize(
        queryText
      );


    const matchedTokens =
      queryTokens.filter(
        token =>
          searchableText.includes(
            token
          )
      );


    score +=
      matchedTokens.length;


    return score;

  }


  async findNode(
    query: string
  ): Promise<KnowledgeEntity | null> {

    const candidates =
      await this.findCandidates(
        query
      );


    if (
      candidates.length === 0
    ) {

      return null;

    }


    const ranked =
      candidates
        .map(
          entity => ({

            entity,

            score:
              this.calculateRelevance(
                query,
                entity
              )

          })
        )
        .sort(
          (a, b) =>
            b.score - a.score
        );


    return ranked[0].entity;

  }


  async findNeighbors(
    id: string
  ): Promise<GraphNeighbor[]> {

    return this.graph.findNeighbors(

      "Proposal",

      id

    );

  }


  async findRelationships(
    id: string
  ): Promise<KnowledgeRelationship[]> {

    return this.graph.findRelationships(

      "Proposal",

      id

    );

  }


  async findSubgraph(
    id: string
  ): Promise<GraphSubgraph> {

    return this.graph.findSubgraph(

      "Proposal",

      id

    );

  }


  async findShortestPath(
    from: string,
    to: string
  ): Promise<GraphPath | null> {

    return this.graph.findShortestPath(

      "Proposal",

      from,

      "Author",

      to

    );

  }

}