import {isEmpty, isHas} from "jsmethod-extra";
import {
    CurrentType,
    QueueElementBase,
    UploadConfigType,
    UploadProgressState
} from "../types";
import {
    emitterAndTaker,
    UPLOADING_FILE_SUBSCRIBE_DEFINE
} from "@/utils/uploader";

// 表示 计算名称的 work
export const calculateNameWorker: CurrentType<null | Worker> = {
    current: null,
};
// 表示 上传文件的配置文件
export const calculateUploaderConfig: CurrentType<UploadConfigType | null> = {
    current: null
}
// 表示 上传进度的状态
export const globalProgressState: CurrentType<Map<string, UploadProgressState>> = {
    current: new Map<string, UploadProgressState>()
}
// 全局的 done callback 映射
export const globalDoneCallbackMapping: CurrentType<Map<string, (error: unknown, baseDir: string) => void>> = {
    current: new Map()
}
// 表示 全局信息
export const globalInfoMapping: Record<string, Map<string, string>> = {};
// 判断是否有相同的文件上传中
export const sameFileUploadStateMapping: CurrentType<Map<string, Array<string>>> = {
    current: new Map()
};
// 全局的暂停指令
export const globalPauseStateMapping: CurrentType<Map<string, number>> = {
    current: new Map()
}

/**
 * 克隆全局的信息 映射事件
 *
 * @author lihh
 * @param source 来源
 * @param target 去向
 */
export function cloneGlobalInfoMappingHandler(source: string, target: string) {
    // 拿到 mapping 信息
    const map = globalInfoMapping[source];
    if (isEmpty(map))
        return;

    // 设置 target 的值
    for (const [key, value] of map)
        putGlobalInfoMappingHandler(target, key, value);
}

/**
 * 设置 全局的信息
 *
 * @author lihh
 * @param args 传递的参数。如果只有一个参数的话，就是删除，三个参数，设置为添加
 */
export function putGlobalInfoMappingHandler(...args: Array<unknown>) {
    if (isEmpty(args)) return;

    if (args.length == 1)
        Reflect.deleteProperty(globalInfoMapping, args[0] as string)
    else {
        const params = args.slice(1), code = args[0] as string;
        if (params.length % 2 !== 0)
            throw new Error("global info mapping params error");
        for (let i = 0; i < params.length; i += 1) {
            const key = params[i], value = params[i + 1];

            let map;
            // 判断 key 是否存在
            if (!isHas(globalInfoMapping, code))
                // 设置默认值
                map = globalInfoMapping[code] = new Map();
            else
                map = globalInfoMapping[code];

            map.set(key, value);
        }
    }
}

/**
 * 计算 字节 大小
 *
 * @author lihh
 * @param c 传递的MB 大小
 */
export const calculateChunkSize = (c: number) => c * 1024 * 1024;

/**
 * 这里是生成唯一的 code
 *
 * @author lihh
 */
export function generateUniqueCode() {
    return `${+new Date()}-${((Math.random() * 100000) | 0)}`
}

/**
 * 是否可以 提交进度状态
 *
 * @author lihh
 * @param uniqueCode 进度唯一的 code
 * @param currentProgressType 当前的状态
 * @return true 不能继续了/ false 不能继续了
 */
export function isCanCommitProgressState(uniqueCode: string, currentProgressType: UploadProgressState) {
    return [UploadProgressState.Pause].includes(globalProgressState.current.get(uniqueCode)!)
        && ![UploadProgressState.Pause, UploadProgressState.Done].includes(currentProgressType);
}

/**
 * 生成 基础的进度状态
 *
 * @author lihh
 * @param type 进度类型
 * @param uniqueCode 表示唯一的 code
 */
export function generateBaseProgressState(type: UploadProgressState, uniqueCode: string) {
    const map = globalInfoMapping[uniqueCode];

    // 表示 基础queue元素
    const baseQueueElement: Required<QueueElementBase> = {
        type,
        uniqueCode,
        uploadFile: map.get("uploadFile") as unknown as File,
        fileName: map.get("fileName")!,
        progress: 0,
        step: 0,
        retryTimes: 0,
        pauseIndex: 0,
        fileSize: map.get("fileSize") as unknown as number,
    };

    // 设置全局的进度状态
    globalProgressState.current.set(uniqueCode, type);
    return baseQueueElement;
}

/**
 * 提交 上传进度状态
 *
 * @author lihh
 * @param type 进度类型
 * @param uniqueCode 表示唯一的值
 */
export function emitUploadProgressState(type: UploadProgressState, uniqueCode: string) {
    if (isCanCommitProgressState(uniqueCode, type))
        return;

    emitterAndTaker.emit(UPLOADING_FILE_SUBSCRIBE_DEFINE, generateBaseProgressState(type, uniqueCode));
}

/**
 * 提交 重试状态
 *
 * @author lihh
 * @param uniqueCode 表示 唯一的code
 * @param retryTimes 重试次数
 */
export function emitRetryProgressState(uniqueCode: string, retryTimes: number) {
    if (isCanCommitProgressState(uniqueCode, UploadProgressState.Retry))
        return;

    // 基础 进度状态
    const baseProgressState = generateBaseProgressState(UploadProgressState.Retry, uniqueCode);
    baseProgressState.retryTimes = retryTimes;

    emitterAndTaker.emit(UPLOADING_FILE_SUBSCRIBE_DEFINE, baseProgressState);
}

/**
 * 提交 上传的的进度状态
 *
 * @author lihh
 * @param type 类型
 * @param uniqueCode 唯一的code
 * @param step 步长
 */
export function emitUploadingProgressState(type: UploadProgressState, uniqueCode: string, step: number) {
    if (isCanCommitProgressState(uniqueCode, type))
        return;

    const baseProgressState = generateBaseProgressState(type, uniqueCode);
    baseProgressState.step = step;

    emitterAndTaker.emit(UPLOADING_FILE_SUBSCRIBE_DEFINE, baseProgressState);
}

/**
 * 提交 暂停进度状态
 *
 * @author lihh
 * @param type 类型
 * @param uniqueCode 唯一的值
 * @param pauseIndex 索引
 */
export function emitPauseProgressState(type: UploadProgressState, uniqueCode: string, pauseIndex: number) {
    if (isCanCommitProgressState(uniqueCode, type))
        return;

    const baseProgressState = generateBaseProgressState(type, uniqueCode);
    baseProgressState.pauseIndex = pauseIndex;

    emitterAndTaker.emit(UPLOADING_FILE_SUBSCRIBE_DEFINE, baseProgressState);
}

/**
 * 全局执行的
 *
 * @author lihh
 */
(function () {
    // 判断 work 是否已经加载完
    if (isEmpty(calculateNameWorker.current)) {
        calculateNameWorker.current = new Worker(
            "/calculateNameWorker.js"
        );
    }
})();
