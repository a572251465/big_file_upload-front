import { isFunction, isNotEmpty, sleep } from "jsmethod-extra";

interface SuccessFnType {
  (code: string): void;
}

export interface FiringTaskType {
  (): Promise<void>;
}

// 表示 单个实例
let instance: PLimit | null = null;

export class PLimit {
  // 表示 最大并发
  private readonly maxConcurrentRequests: number;
  private readonly successCallback: SuccessFnType;
  // 表示 当前执行的任务数
  private currentExecuteTaskCount: number = 0;
  // 表示等待的任务
  private waitTasks: Array<[string, FiringTaskType]> = [];

  constructor(maxConcurrentRequests: number, successCallback: SuccessFnType) {
    this.maxConcurrentRequests = maxConcurrentRequests || 5;
    this.successCallback = successCallback;
  }

  /**
   * 获取到 PLimit 实例
   *
   * @author lihh
   * @param maxConcurrentRequests 最大并发数
   * @param successCallback
   */
  static getInstance(
    maxConcurrentRequests: number,
    successCallback: SuccessFnType,
  ) {
    // 判断单例是否存在
    if (isNotEmpty(instance)) return instance;
    instance = new PLimit(maxConcurrentRequests, successCallback);
    return instance;
  }

  /**
   * 表示执行任务
   *
   * @author lihh
   */
  private executeTask(task: [string, FiringTaskType]) {
    // 判断 任务是否超过限制
    if (this.currentExecuteTaskCount >= this.maxConcurrentRequests) return;

    this.currentExecuteTaskCount += 1;
    const [code, asyncMethod] = task;

    Promise.resolve().then(async () => {
      await asyncMethod();
      if (isFunction(this.successCallback)) this.successCallback(code);

      this.currentExecuteTaskCount -= 1;

      // 随机等待一定时间, 避免并发修改
      await sleep((Math.random() * 20) | 0);

      // 拿到新的任务
      const newTask = this.waitTasks.shift();
      if (isNotEmpty(newTask)) this.executeTask(newTask);
    });
  }

  /**
   * 表示 发射任务
   *
   * @author lihh
   * @param argTasks 添加多个任务
   */
  firingTask(...argTasks: Array<[string, FiringTaskType]>) {
    // 判断当前执行任务 是否 大于 最大任务
    if (this.currentExecuteTaskCount >= this.maxConcurrentRequests) {
      // 直接 添加到等待任务中
      this.waitTasks.push(...argTasks);
      return;
    }

    // 如果能执行到这里的话，说明没到最大并发数
    // 计算剩下 可以执行的任务
    const maxCount = this.maxConcurrentRequests;
    // 如果条件【currentExecuteTaskCount == 0】的话，那么值 surplusCount 就是 5
    const surplusCount = Math.min(
      maxCount - this.currentExecuteTaskCount,
      maxCount,
      argTasks.length,
    );
    // 这里开始执行任务
    for (let i = 0; i < surplusCount; i++) this.executeTask(argTasks[i]);

    // 表示等待的任务 count
    const waitTaskCount = argTasks.length - surplusCount;
    if (waitTaskCount > 0) this.waitTasks.push(...argTasks.slice(surplusCount));
  }
}
