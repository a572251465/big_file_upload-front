import { QueueElementRequired } from "../types";

export class Queue {
  // 单项队列
  private singleQueue: Array<QueueElementRequired>;

  constructor() {
    this.singleQueue = [];
  }

  lastAdd(item: QueueElementRequired) {
    this.singleQueue.push(item);
  }

  firstRemove() {
    return this.singleQueue.shift();
  }
}
