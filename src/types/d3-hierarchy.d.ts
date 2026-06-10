declare module 'd3-hierarchy' {
  export interface HierarchyNode<Datum> {
    data: Datum
    depth: number
    parent: HierarchyNode<Datum> | null
    x: number
    y: number
    descendants(): HierarchyNode<Datum>[]
    links(): HierarchyLink<Datum>[]
  }

  export interface HierarchyLink<Datum> {
    source: HierarchyNode<Datum>
    target: HierarchyNode<Datum>
  }

  export interface TreeLayout<Datum> {
    (root: HierarchyNode<Datum>): HierarchyNode<Datum>
    nodeSize(size: [number, number]): TreeLayout<Datum>
  }

  export function hierarchy<Datum>(
    data: Datum,
    children?: (node: Datum) => readonly Datum[] | Datum[] | undefined
  ): HierarchyNode<Datum>

  export function tree<Datum>(): TreeLayout<Datum>
}
