import {
    calculateNameWorker,
    calculateUploaderConfig,
    emitPauseProgressState,
    emitRetryProgressState,
    emitUploadingProgressState,
    emitUploadProgressState,
    generateUniqueCode,
    globalDoneCallbackMapping,
    globalInfoMapping,
    globalPauseStateMapping,
    globalProgressState,
    putGlobalInfoMappingHandler,
    sameFileUploadStateMapping,
} from "./utils/tools";
import {equals, isNotEmpty, sleep} from "jsmethod-extra";
import {
    ChunkFileType,
    QueueElementBase,
    UploadConfigType,
    UploadProgressState
} from "./types";
import {
    createFileChunks,
    emitterAndTaker,
    PLimit,
    REVERSE_CONTAINER_ACTION,
    UPLOADING_FILE_SUBSCRIBE_DEFINE
} from "@/utils/uploader";
import {
    listFilesReq,
    mergeUploadReq,
    sectionUploadReq,
    verifyFileExistReq
} from "@/api/upload";

// 表示 并发限制
let pLimit: PLimit | null = null;
// 表示 默认的配置文件
const uploaderDefaultConfig: UploadConfigType = {
    concurrentLimit: 3,
    maxRetryTimes: 3
};

// 监听 暂停/ 取消的监听动作
emitterAndTaker.on(REVERSE_CONTAINER_ACTION, function (uniqueCode: string, action: UploadProgressState) {
    // 判断 动作是否合法
    if (
        ![UploadProgressState.Pause, UploadProgressState.Canceled].includes(action)
        || !globalProgressState.current.has(uniqueCode)
    )
        return;

    // 同时 修改状态
    globalProgressState.current.set(uniqueCode, action);


    switch (action) {
        case UploadProgressState.Canceled:
            emitUploadProgressState(UploadProgressState.Canceled, uniqueCode);
            break;
        case UploadProgressState.Pause: {
            // 是否已经被暂停了
            const isPaused = globalPauseStateMapping.current.get(uniqueCode)!;
            if (isPaused) {
                // 表示暂停后 重新启动
            }
            break;
        }
    }
});
// 订阅事件【UPLOADING_FILE_SUBSCRIBE_DEFINE】，每个状态改变 都会执行这个方法
emitterAndTaker.on(UPLOADING_FILE_SUBSCRIBE_DEFINE, function (el: QueueElementBase) {
    // 同时订阅 判断指定的状态
    switch (el.type) {
        case UploadProgressState.RetryFailed:
        case UploadProgressState.Done:
        case UploadProgressState.Canceled:
            progressNormalOrErrorCompletionHandler(el);
            break;

        // 这里是暂停处理
        case UploadProgressState.Pause:
            // 设置暂停状态
            if (!globalPauseStateMapping.current.has(el.uniqueCode!))
                globalPauseStateMapping.current.set(el.uniqueCode!, el.pauseIndex!);
    }
})

/**
 * 正常 异常结束的事件
 *
 * @author lihh
 * @param el queue 消息
 */
function progressNormalOrErrorCompletionHandler(el: QueueElementBase) {
    const {uniqueCode} = el;

    // 表示将要删除的元素
    const willDeleteElements: Array<string> = [];
    for (const [key, value] of sameFileUploadStateMapping.current)
        if (equals(uniqueCode, value))
            willDeleteElements.push(key);

    // 删除元素
    for (const key of willDeleteElements)
        sameFileUploadStateMapping.current.delete(key);
}

/**
 * 计算断点续传的索引
 *
 * @author lihh
 * @param calculationHashCode web worker 计算的code
 * @param uniqueCode 表示唯一的code
 * @param step 表示步长
 */
export async function computedBreakPointProgressHandler(calculationHashCode: string, uniqueCode: string, step: number) {
    // 从这里 判断是否断点续传
    const res = await listFilesReq(calculationHashCode);
    if (res.success && isNotEmpty(res.data)) {
        const {length} = res.data;
        // 断点续传状态
        emitUploadingProgressState(UploadProgressState.BreakPointUpload, uniqueCode, step * length);
        // 断点续传，设置等待状态
        await sleep(1000);

        return length;
    }
    return 0;
}

/**
 * 是否可以 继续执行
 *
 * @author lihh
 * @param uniqueCode 唯一的code
 */
const isCanNextExecute = (uniqueCode: string) => [UploadProgressState.Waiting, UploadProgressState.Uploading, UploadProgressState.Retry].includes(globalProgressState.current.get(uniqueCode)!)

/**
 * 是否需要中断
 *
 * @author lihh
 * @param uniqueCode 文件唯一的code
 */
const isNeedInterrupt = (uniqueCode: string) => !isCanNextExecute(uniqueCode);

/**
 * 分割文件 上传事件
 *
 * @author lihh
 * @param idx 开始索引
 * @param uniqueCode 唯一的code
 * @param calculationHashCode web worker 计算的hashCode
 * @param chunks 分割的文件
 * @param retryTimes 重试次数
 */
export async function splitFileUploadingHandler(idx: number, uniqueCode: string, calculationHashCode: string, chunks: Array<ChunkFileType>, retryTimes = 0) {
    // 步长, 保留一个小数点
    const step = +(100 / chunks.length).toFixed(1);

    // 如果循环执行结束后，说明分片文件上传结束。
    for (; idx < chunks.length && isCanNextExecute(uniqueCode);) {
        const {chunk, chunkFileName} = chunks[idx];

        // 表示 formData 参数
        const formData = new FormData();
        formData.append("file", chunk);
        const res = await sectionUploadReq(calculationHashCode, chunkFileName, formData);

        await sleep(2000);

        // 判断是否写入成功
        if (res.success) {
            // 修改 上传中的状态
            emitUploadingProgressState(UploadProgressState.Uploading, uniqueCode, step);
            idx += 1;
        } else {
            // 判断 是否重试失败
            const {maxRetryTimes} = calculateUploaderConfig.current!;
            if (retryTimes >= maxRetryTimes) {
                // 设置 重试失败 状态
                emitUploadProgressState(UploadProgressState.RetryFailed, uniqueCode);
                idx = chunks.length;
                return
            }

            // 表示 重试次数
            retryTimes += 1;
            // 修改为重试状态
            emitRetryProgressState(uniqueCode, retryTimes);
            // 一旦执行到这里，说明上传失败了。尝试重新上传
            await splitFileUploadingHandler(idx, uniqueCode, calculationHashCode, chunks, retryTimes);
        }
    }

    // 表示当前的状态
    const currentProgressState = globalProgressState.current.get(uniqueCode)!;
    // 判断是否暂停指令停止的
    if (equals(UploadProgressState.Pause, currentProgressState))
        emitPauseProgressState(UploadProgressState.Pause, uniqueCode, idx);
}

/**
 * 表示生成任务
 *
 * @author lihh
 * @param calculationHashCode 通过 webWorker 计算的hash值
 * @param uniqueCode 唯一的值
 * @param chunks 分割的文件
 */
export async function generateTask(calculationHashCode: string, uniqueCode: string, chunks: Array<ChunkFileType>) {
    // 如果是异常状态，就没必要往下走了
    if (isNeedInterrupt(uniqueCode))
        return;

    // 步长, 保留一个小数点
    const step = +(100 / chunks.length).toFixed(1);

    // 判断 是否断点续传
    const idx = await computedBreakPointProgressHandler(calculationHashCode, uniqueCode, step);
    // 开始分片上传
    await splitFileUploadingHandler(idx, uniqueCode, calculationHashCode, chunks);

    // 如果是异常的状态，就没必要往下走了
    if (isNeedInterrupt(uniqueCode))
        return;

    // 修改状态 为 合并状态
    emitUploadProgressState(UploadProgressState.Merge, uniqueCode);

    // 开始尝试合并文件
    const extName = globalInfoMapping[uniqueCode].get("extName")!;
    const res = await mergeUploadReq(calculationHashCode, `${calculationHashCode}.${extName}`);
    if (res.success) {
        // 表示 合并成功
        emitUploadProgressState(UploadProgressState.Done, uniqueCode);

        // 删除缓存数据
        Reflect.deleteProperty(globalInfoMapping, uniqueCode);
        globalProgressState.current.delete(uniqueCode);
        globalDoneCallbackMapping.current.delete(uniqueCode);
    }
}

/**
 * 开始上传文件
 *
 * @author lihh
 * @param file 要上传的文件
 * @param calculationHashName 通过web worker 计算的hash名称
 * @param uniqueCode 生成的唯一 code
 */
export async function startUploadFileHandler(file: File, calculationHashName: string, uniqueCode: string) {
    // 进行请求 实现秒传
    const res = await verifyFileExistReq(calculationHashName);
    if (res.success) {
        // 从这里 修改 秒传状态
        emitUploadProgressState(UploadProgressState.QuickUpload, uniqueCode)
        return;
    }

    // 将 文件分为多份
    const fileChunks = createFileChunks(file, calculationHashName),
        calculationHashCode = calculationHashName.split(".").shift()!;
    // 开始生成任务
    const task = generateTask.bind(null, calculationHashCode, uniqueCode, fileChunks);

    // 是否设置默认配置
    if (!calculateUploaderConfig.current)
        uploadHandler.config(uploaderDefaultConfig);
    // 添加并且发射任务, 每次添加一个文件，就会发射文件
    if (!pLimit)
        pLimit = PLimit.getInstance(calculateUploaderConfig.current!.concurrentLimit)
    pLimit!.firingTask(task);
}

/**
 * 异步 web worker 加载动作
 *
 * @author lihh
 * @param uploadFile 上传文件
 * @param uniqueCode 文件对应的唯一 code值
 */
function asyncWebWorkerActionHandler(uploadFile: File, uniqueCode: string) {
    // 判断是否加载 worker
    if (isNotEmpty(calculateNameWorker.current)) {
        // 将 上传的文件 发送给 webWorker 来计算hash
        calculateNameWorker.current!.postMessage(uploadFile);
        // 添加订阅事件
        calculateNameWorker.current!.onmessage = async function (event) {
            const calculationHashName = event.data;
            // 判断 是否相同文件上传中
            if (sameFileUploadStateMapping.current.has(calculationHashName)) {
                emitUploadProgressState(UploadProgressState.OtherUploading, uniqueCode);
                return;
            }
            // 添加缓存
            sameFileUploadStateMapping.current.set(calculationHashName, uniqueCode);

            // 修改状态为 等待状态
            emitUploadProgressState(UploadProgressState.Waiting, uniqueCode);
            // 开始上传文件
            await startUploadFileHandler(uploadFile, calculationHashName, uniqueCode);
        }
    } else {
        throw new Error("web worker not supported");
    }
}

/**
 * 表示上传的事件
 *
 * @author lihh
 * @param uploadFile 要上传的文件
 * @param callback 上传文件的 回调方法
 */
export function uploadHandler(
    uploadFile: File,
    callback: (error: unknown, baseDir: string) => void
) {
    // 每个文件分配一个code，唯一的code
    const uniqueCode = generateUniqueCode();
    globalDoneCallbackMapping.current.set(uniqueCode, callback);

    // 表示文件名称
    const {name: fileName, size: fontSize} = uploadFile;
    // 表示文件后缀
    const extName = fileName.split(".").shift()!;
    // 将属性设置为全局属性，方便获取
    putGlobalInfoMappingHandler(uniqueCode, "fileName", fileName, "uniqueCode", uniqueCode, "fontSize", fontSize, "extName", extName, "uploadFile", uploadFile);
    // 修改状态
    emitUploadProgressState(UploadProgressState.Prepare, uniqueCode);

    // 判断是否加载 worker
    asyncWebWorkerActionHandler(uploadFile, uniqueCode);
}

/**
 * 上传文件的配置
 *
 * @author lihh
 * @param config 配置文件
 */
uploadHandler.config = function (config: UploadConfigType) {
    // 全局设置 配置文件
    calculateUploaderConfig.current = Object.assign({}, uploaderDefaultConfig, config);
}
