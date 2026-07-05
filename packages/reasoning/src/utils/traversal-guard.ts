export class TraversalGuard {

  constructor(

    private readonly visited =
      new Set<string>()

  ) {}

  has(

    id: string

  ): boolean {

    return this.visited.has(id);

  }

  add(

    id: string

  ): void {

    this.visited.add(id);

  }

  size(): number {

    return this.visited.size;

  }

}