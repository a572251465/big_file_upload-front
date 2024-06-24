import {
    equals,
    isArray,
    isEmpty,
    isFunction,
    isNotEmpty,
    sleep
} from "jsmethod-extra";
import {
    listFilesReq,
    mergeUploadReq,
    sectionUploadReq,
    verifyFileExistReq,
} from "@/api/upload";
import {
    calculateNameWorker,
    calculateUploaderConfig,
    ChunkFileType,
    cloneGlobalInfoMappingHandler,
    createFileChunks,
    defaultEmptyFunction,
    emitPauseProgressState,
    emitRetryProgressState,
    emitUploadingProgressState,
    emitUploadProgressState,
    generateUniqueCode,
    globalDoneCallbackMapping,
    globalInfoMapping,
    globalPauseStateMapping,
    globalProgressState,
    PLimit,
    pLimit,
    putGlobalInfoMappingHandler,
    QueueElementBase,
    sameFileUploadStateMapping,
    upConcurrentHandler,
    UploadConfigType,
    uploaderDefaultConfig,
    UploadProgressState,
} from "./tool";

/**
 * 重新 上传文件
 *
 * @author lihh
 * @param uniqueCode 文件 唯一的code
 * @param newType 要修改的状态
 */
export async function restartUploadFileHandler(
    uniqueCode: string,
    newType: UploadProgressState,
) {
    // 表示暂停后 重新启动
    const map = globalInfoMapping[uniqueCode],
        uploadFile = map.get("uploadFile") as any as File,
        calculationHashName = map.get("calculationHashName")!;

    // 修改状态
    globalProgressState.current.set(uniqueCode, newType);
    emitUploadProgressState(newType, uniqueCode);

    // 重新开始上传
    await startUploadFileHandler(uploadFile, calculationHashName, uniqueCode);
}

/**
 * 相同文件 是否继续下载
 *
 * @author lihh
 * @param uniqueCode 文件 唯一的code
 */
export async function sameFileNeedProceedHandler(uniqueCode: string) {
    // 通过唯一的code 拿到map 集合
    const map = globalInfoMapping[uniqueCode!],
        calculationHashName = map.get("calculationHashName")!;

    // 从 map集合中 拿到除了【uniqueCode】 的其他code
    const uniqueCodeValues =
        sameFileUploadStateMapping.current.get(calculationHashName);
    if (isEmpty(uniqueCodeValues)) return;

    // 拿到剩余的 values
    const newUniqueCodeValues = uniqueCodeValues!.filter(
        (code) => !equals(code, uniqueCode),
    );
    // 等待的状态 批量上传
    newUniqueCodeValues!.forEach((code) =>
        restartUploadFileHandler(code, UploadProgressState.Waiting),
    );
}

/**
 * 正常 异常结束的事件
 *
 * @author lihh
 * @param el queue 消息
 */
export function progressNormalOrErrorCompletionHandler(el: QueueElementBase) {
    const {uniqueCode} = el;

    // 拿到 calculationHashName
    const calculationHashName = globalInfoMapping[uniqueCode!].get(
        "calculationHashName",
    )!;
    // 判断 calculationHashName 是否存在
    if (!sameFileUploadStateMapping.current.has(calculationHashName)) return;

    // 判断 calculationHashName 对应的value 是否为空
    const uniqueCodeValue =
        sameFileUploadStateMapping.current.get(calculationHashName);
    if (isEmpty(uniqueCodeValue)) {
        sameFileUploadStateMapping.current.delete(calculationHashName);
        return;
    }

    // 此时的key 是 文件计算的hash值
    // 此时的value 是 每个文件唯一的 code
    // 假如 [xxx.mp4, [xxx01, xxx02, xxx03]]
    const index = uniqueCodeValue!.indexOf(uniqueCode!);
    if (index !== -1) {
        uniqueCodeValue?.splice(index, 1);
        // 循环判断 是否已经彻底删除
        progressNormalOrErrorCompletionHandler(el);
    }
}

/**
 * 清除 缓存状态
 *
 * @author lihh
 */
export function clearCacheStateHandler(uniqueCode: string) {
    // 删除缓存数据
    Reflect.deleteProperty(globalInfoMapping, uniqueCode);
    globalProgressState.current.delete(uniqueCode);
    globalDoneCallbackMapping.current.delete(uniqueCode);
    globalPauseStateMapping.current.delete(uniqueCode);
}

/**
 * 计算断点续传的索引
 *
 * @author lihh
 * @param calculationHashCode web worker 计算的code
 * @param uniqueCode 表示唯一的code
 * @param step 表示步长
 */
export async function computedBreakPointProgressHandler(
    calculationHashCode: string,
    uniqueCode: string,
    step: number,
) {
    // 从这里 判断是否断点续传
    const res = await listFilesReq(calculationHashCode);
    if (res.success && isNotEmpty(res.data)) {
        const {length} = res.data;
        // 断点续传状态
        emitUploadingProgressState(
            UploadProgressState.BreakPointUpload,
            uniqueCode,
            step * length,
        );
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
function isCanNextExecute(uniqueCode: string) {
    return [
        UploadProgressState.Waiting,
        UploadProgressState.Uploading,
        UploadProgressState.Retry,
        UploadProgressState.PauseRetry,
    ].includes(globalProgressState.current.get(uniqueCode)!);
}

/**
 * 是否需要中断
 *
 * @author lihh
 * @param uniqueCode 文件唯一的code
 */
function isNeedInterrupt(uniqueCode: string) {
    return !isCanNextExecute(uniqueCode);
}

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
export async function splitFileUploadingHandler(
    idx: number,
    uniqueCode: string,
    calculationHashCode: string,
    chunks: Array<ChunkFileType>,
    retryTimes = 0,
) {
    // 步长, 保留一个小数点
    const step = +(100 / chunks.length) | 0;

    // 如果循环执行结束后，说明分片文件上传结束。
    for (; idx < chunks.length && isCanNextExecute(uniqueCode);) {
        const {chunk, chunkFileName} = chunks[idx];

        await upConcurrentHandler(100);

        // 表示 formData 参数
        const formData = new FormData();
        formData.append("file", chunk);
        const res = await sectionUploadReq(
            calculationHashCode,
            chunkFileName,
            formData,
        );

        // 判断是否写入成功
        if (res.success) {
            // <补丁> 从这里判断下 是否暂停了, 防止并发覆盖状态
            // 可能已经暂停了，但是异步请求发送了，所以要放弃这次操作
            if (
                equals(
                    UploadProgressState.Pause,
                    globalProgressState.current.get(uniqueCode),
                )
            )
                continue;

            // 修改 上传中的状态
            emitUploadingProgressState(
                UploadProgressState.Uploading,
                uniqueCode,
                step,
            );
            idx += 1;
        } else {
            // 判断 是否重试失败
            const {maxRetryTimes} = calculateUploaderConfig.current!;
            if (retryTimes >= maxRetryTimes) {
                // 设置 重试失败 状态
                emitUploadProgressState(UploadProgressState.RetryFailed, uniqueCode);
                idx = chunks.length;
                return;
            }

            // 表示 重试次数
            retryTimes += 1;
            // 修改为重试状态
            emitRetryProgressState(uniqueCode, retryTimes);
            // 一旦执行到这里，说明上传失败了。尝试重新上传
            await splitFileUploadingHandler(
                idx,
                uniqueCode,
                calculationHashCode,
                chunks,
                retryTimes,
            );
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
export async function generateTask(
    calculationHashCode: string,
    uniqueCode: string,
    chunks: Array<ChunkFileType>,
) {
    // 如果是异常状态，就没必要往下走了
    if (isNeedInterrupt(uniqueCode)) return;

    // 步长, 保留一个小数点
    const step = +(100 / chunks.length) | 0;

    let idx;
    // 判断是否为 暂停重试
    const currentProgressState = globalProgressState.current.get(uniqueCode);
    if (equals(currentProgressState, UploadProgressState.PauseRetry)) {
        idx = globalPauseStateMapping.current.get(uniqueCode)!;
        // 已经使用到了 直接删除
        globalPauseStateMapping.current.delete(uniqueCode);
    }
    // 判断 是否断点续传
    else {
        idx = await computedBreakPointProgressHandler(
            calculationHashCode,
            uniqueCode,
            step,
        );
    }
    // 开始分片上传
    await splitFileUploadingHandler(idx, uniqueCode, calculationHashCode, chunks);

    // 如果是异常的状态，就没必要往下走了
    if (isNeedInterrupt(uniqueCode)) return;

    // 修改状态 为 合并状态
    emitUploadProgressState(UploadProgressState.Merge, uniqueCode);

    // 开始尝试合并文件
    const extName = globalInfoMapping[uniqueCode].get("extName")!;
    const res = await mergeUploadReq(
        calculationHashCode,
        `${calculationHashCode}.${extName}`,
    );
    if (res.success)
        // 表示 合并成功
        emitUploadProgressState(UploadProgressState.Done, uniqueCode);
}

/**
 * 开始上传文件
 *
 * @author lihh
 * @param file 要上传的文件
 * @param calculationHashName 通过web worker 计算的hash名称
 * @param uniqueCode 生成的唯一 code
 */
export async function startUploadFileHandler(
    file: File,
    calculationHashName: string,
    uniqueCode: string,
) {
    // 进行请求 实现秒传
    const res = await verifyFileExistReq(calculationHashName);
    if (res.success) {
        // 从这里 修改 秒传状态
        emitUploadProgressState(UploadProgressState.QuickUpload, uniqueCode);
        return;
    }

    // 将 文件分为多份
    const fileChunks = createFileChunks(file, calculationHashName),
        calculationHashCode = calculationHashName.split(".").shift()!;
    // 开始生成任务
    const task = generateTask.bind(
        null,
        calculationHashCode,
        uniqueCode,
        fileChunks,
    );

    // 是否设置默认配置
    if (!calculateUploaderConfig.current)
        uploadHandler.config(uploaderDefaultConfig);
    // 添加并且发射任务, 每次添加一个文件，就会发射文件
    if (!pLimit.current)
        pLimit.current = PLimit.getInstance(
            calculateUploaderConfig.current!.concurrentLimit,
        );
    pLimit.current!.firingTask(task);
}

/**
 * 相同文件 上传处理
 *
 * @author lihh
 * @param calculationHashName 根据文件计算出 hash值
 * @param uniqueCode 每个文件对应 code
 */
function sameFileUploadingHandler(
    calculationHashName: string,
    uniqueCode: string,
) {
    let uniqueCodeArr =
        sameFileUploadStateMapping.current.get(calculationHashName);
    // 判断 是否为数组
    if (!isArray(uniqueCodeArr))
        sameFileUploadStateMapping.current.set(
            calculationHashName,
            (uniqueCodeArr = []),
        );

    // 添加到数组中
    uniqueCodeArr.push(uniqueCode);
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
            // 将 hashName 也保存起来
            putGlobalInfoMappingHandler(
                uniqueCode,
                "calculationHashName",
                calculationHashName,
            );

            // 判断 是否相同文件上传中
            if (sameFileUploadStateMapping.current.has(calculationHashName)) {
                sameFileUploadingHandler(calculationHashName, uniqueCode);
                // 克隆 mapping 信息
                cloneGlobalInfoMappingHandler(
                    sameFileUploadStateMapping.current.get(calculationHashName)![0],
                    uniqueCode,
                );

                emitUploadProgressState(UploadProgressState.OtherUploading, uniqueCode);
                return;
            }
            // 相同文件 处理
            sameFileUploadingHandler(calculationHashName, uniqueCode);

            // 修改状态为 等待状态
            emitUploadProgressState(UploadProgressState.Waiting, uniqueCode);
            // 开始上传文件
            await startUploadFileHandler(uploadFile, calculationHashName, uniqueCode);
        };
    } else {
        throw new Error("web worker not supported");
    }
}

/**
 * 表示上传的事件
 *
 * @author lihh
 * @param uploadFile 要上传的文件
 * @param callback 默认的回调方法
 */
export function uploadHandler(
    uploadFile: File,
    callback?: (baseDir: string) => void
) {
    return new Promise<string>(async (resolve, reject) => {
        // 每个文件分配一个code，唯一的code
        const uniqueCode = generateUniqueCode();
        // 判断 callback 是否一个方法
        if (!isFunction(callback))
            callback = defaultEmptyFunction

        globalDoneCallbackMapping.current.set(uniqueCode, [resolve, reject, callback]);

        // 表示文件名称
        const {name: fileName, size: fontSize} = uploadFile;
        // 表示文件后缀
        const extName = fileName.split(".").pop()!;
        // 将属性设置为全局属性，方便获取
        putGlobalInfoMappingHandler(
            uniqueCode,
            "fileName",
            fileName,
            "uniqueCode",
            uniqueCode,
            "fontSize",
            fontSize,
            "extName",
            extName,
            "uploadFile",
            uploadFile,
        );
        // 修改状态
        emitUploadProgressState(UploadProgressState.Prepare, uniqueCode);
        await upConcurrentHandler(1000);

        // 判断是否加载 worker
        asyncWebWorkerActionHandler(uploadFile, uniqueCode);
    });
}

/**
 * 上传文件的配置
 *
 * @author lihh
 * @param config 配置文件
 */
uploadHandler.config = function (config: UploadConfigType) {
    // 全局设置 配置文件
    calculateUploaderConfig.current = Object.assign(
        {},
        uploaderDefaultConfig,
        config,
    );
};