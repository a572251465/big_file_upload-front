import {isEmpty, isHas} from "jsmethod-extra";
import {
    CurrentType,
    QueueElementBase,
    UploadProgressState
} from "../types";
import {emitterAndTaker} from "@/utils/uploader/src/utils/emitterAndTaker.ts";
import {UPLOADING_FILE_SUBSCRIBE_DEFINE} from "@/utils/uploader";

// 表示 计算名称的 work
export const calculateNameWorker: CurrentType<null | Worker> = {
    current: null,
};
// 判断某个文件是否上传中
export const uploadFileStateMapping = new Map<string, boolean>();
// 表示 全局信息
export const globalInfoMapping: Record<string, Map<string, string>> = {};

/**
 * 表示 删除 文件状态映射
 *
 * @author lihh
 * @param key 唯一的key
 */
export function removeFileStateMappingHandler(key: string) {
    uploadFileStateMapping.delete(key);
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
 * 生成 基础的进度状态
 *
 * @author lihh
 * @param type 进度类型
 * @param code 唯一的code
 */
export function generateBaseProgressState(type: UploadProgressState, code: string) {
    const map = globalInfoMapping[code];

    // 表示 基础queue元素
    const baseQueueElement: Required<QueueElementBase> = {
        type,
        code,
        fileName: map.get("fileName")!,
        blockMark: map.get("blockMark")!,
        progress: 0,
        step: 0,
        totalSize: map.get("totalSize") as any as number,
    };

    return baseQueueElement;
}

/**
 * 提交 上传进度状态
 *
 * @author lihh
 * @param type 进度类型
 * @param code 表示唯一的值
 */
export function emitUploadProgressState(type: UploadProgressState, code: string) {
    emitterAndTaker.emit(UPLOADING_FILE_SUBSCRIBE_DEFINE, generateBaseProgressState(type, code));
}

/**
 * 提交 上传的的进度状态
 *
 * @author lihh
 * @param type 类型
 * @param code 唯一的code
 * @param step 步长
 */
export function emitUploadingProgressState(type: UploadProgressState, code: string, step: number) {
    const baseProgressState = generateBaseProgressState(type, code);
    baseProgressState.step = step;

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
