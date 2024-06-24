import {CurrentType, UploadConfigType, UploadProgressState} from "./types";
import {PLimit} from "./PLimit";

export const pLimit: CurrentType<PLimit | null> = {
    current: null,
};
// 表示 默认的配置文件
export const uploaderDefaultConfig: UploadConfigType = {
    concurrentLimit: 1,
    maxRetryTimes: 3,
};

export const calculateNameWorker: CurrentType<null | Worker> = {
    current: null,
};
// 表示 上传文件的配置文件
export const calculateUploaderConfig: CurrentType<UploadConfigType | null> = {
    current: null,
};
// 表示 上传进度的状态
export const globalProgressState: CurrentType<
    Map<string, UploadProgressState>
> = {
    current: new Map<string, UploadProgressState>(),
};
// 全局的 done callback 映射
export const globalDoneCallbackMapping: CurrentType<
    Map<string, [(baseDir: string) => void, (error: unknown) => void, (baseDir: string) => void]>
> = {
    current: new Map(),
};
// 表示 全局信息
export const globalInfoMapping: Record<string, Map<string, string>> = {};
// 判断是否有相同的文件上传中
export const sameFileUploadStateMapping: CurrentType<
    Map<string, Array<string>>
> = {
    current: new Map(),
};
// 全局的暂停指令
export const globalPauseStateMapping: CurrentType<Map<string, number>> = {
    current: new Map(),
};

// 这是一个默认的空方法
export function defaultEmptyFunction(baseDir: string) {
    if (true)
        console.log(baseDir);
}
