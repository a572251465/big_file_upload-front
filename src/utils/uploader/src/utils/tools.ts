// import { isEmpty, strFormat } from "jsmethod-extra";
import { CurrentType } from "../types";

// 表示 计算名称的 work
export const calculateNameWorker: CurrentType<null | Worker> = {
  current: null,
};
// 表示二级目录
export const publicPath: CurrentType<string> = {
  current: "",
};

/**
 * 计算 字节 大小
 *
 * @author lihh
 * @param c 传递的MB 大小
 */
export const calculateChunkSize = (c: number) => c * 1024 * 1024;

// export function emitUploadProgressState(type: UploadProgressState) {}

/**
 * 全局执行的
 *
 * @author lihh
 */
// (function () {
//   // 判断 work 是否已经加载完
//   if (isEmpty(calculateNameWorker.current)) {
//     calculateNameWorker.current = new Worker(
//       strFormat("%s/calculateNameWorker.js", publicPath.current),
//     );
//   }
// })();
