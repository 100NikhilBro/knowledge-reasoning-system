export interface TraversalLimits {

  maxDepth: number;

  maxNodes: number;

}

export class TraversalLimiter {

  constructor(

    private readonly limits: TraversalLimits

  ) {}

  canContinue(

    depth: number,

    visitedNodes: number

  ): boolean {

    return (

      depth <= this.limits.maxDepth &&

      visitedNodes < this.limits.maxNodes

    );

  }

}