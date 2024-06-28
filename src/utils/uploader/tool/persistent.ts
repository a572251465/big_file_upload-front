import { QueueElementBase, UploadProgressState } from "@/utils";

// 只拦截特殊的状态
const filterNoNeedState: Array<UploadProgressState> = [
  UploadProgressState.Uploading,
  UploadProgressState.Pause,
  UploadProgressState.PauseRetry,
  UploadProgressState.Retry,
  UploadProgressState.Merge,
];

/* 持久化缓存 动作 */
const persistenceCacheAction = {
  getAll: function () {},
  /* 删除 某个缓存 */
  remove: function (uniqueCode: string) {
    console.log(uniqueCode);
  },
};

/**
 * 添加 进度状态的事件
 *
 * @author lihh
 * @param el 添加的元素
 */
function addProgressStateHandler(el: QueueElementBase) {
  // 判断是否为 结束的状态
  if (
    [
      UploadProgressState.Done,
      UploadProgressState.QuickUpload,
      UploadProgressState.Canceled,
      UploadProgressState.RetryFailed,
    ].includes(el.type!)
  ) {
    persistenceCacheAction.remove(el.uniqueCode!);
    return;
  }

  if (!filterNoNeedState.includes(el.type!)) return;
}

export function usePersistent() {
  return [addProgressStateHandler];
}
