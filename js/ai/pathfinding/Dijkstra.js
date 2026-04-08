import { MinHeap } from "./util/MinHeap";
import { Pathfinder } from "./Pathfinder";


export class Dijkstra extends Pathfinder {

  constructor() {
    super();
  }

  // Implement our findPath as Dijkstra
  findPath(start, end, map) {
  
    // Keep track of three things
    let open = new MinHeap();
    let costs = new Map();
    let parents = new Map();

    // It costs nothing to get to start
    costs.set(start, 0);

    // There is no parent of start
    parents.set(start, null);

    // Enqueue at a cost of 0
    open.enqueue(start, 0);

    while (!open.isEmpty()) {

      let current = open.dequeue();

      if (current === end) {
        return this.tracePath(parents, start, end);
      }

      for (let neighbour of map.getNeighbours(current)) {
        let newCost = costs.get(current) + neighbour.cost;

        if (!costs.has(neighbour) || newCost < costs.get(neighbour)) {
          parents.set(neighbour, current);
          costs.set(neighbour, newCost);
          open.enqueue(neighbour, newCost);
        }
      }
    }
    return [];
  }

}