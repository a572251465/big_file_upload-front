import {
    calculateNameWorker,
    calculateUploaderConfig,
    emitUploadingProgressState,
    emitUploadProgressState,
    generateUniqueCode,
    globalInfoMapping,
    putGlobalInfoMappingHandler
} from "./utils/tools";
import {isNotEmpty, sleep} from "jsmethod-extra";
import {ChunkFileType, UploadConfigType, UploadProgressState} from "./types";
import {createFileChunks, PLimit} from "@/utils/uploader";
import {
    listFilesReq,
    mergeUploadReq,
    sectionUploadReq,
    verifyFileExistReq
} from "@/api/upload";

// 表示 并发限制
const pLimit = PLimit.getInstance(3);
// 表示 默认的配置文件
const uploaderDefaultConfig: UploadConfigType = {
    concurrentLimit: 3,
    maxRetryTimes: 3
};

/**
 * 计算断点续传的索引
 *
 * @author lihh
 * @param calculationHashCode web worker 计算的code
 * @param step 表示步长
 */
export async function computedBreakPointProgressHandler(calculationHashCode: string, step: number) {
    // 从这里 判断是否断点续传
    const res = await listFilesReq(calculationHashCode),
        length = res.data.length;
    if (res.success && isNotEmpty(res.data)) {
        // 断点续传状态
        emitUploadingProgressState(UploadProgressState.BreakPointUpload, calculationHashCode, step * length);
        // 断点续传，设置等待状态
        await sleep(1000);

        return length;
    }
    return 0;
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
    // 步长, 保留一个小数点
    const step = +(100 / chunks.length).toFixed(1);

    // 如果循环执行结束后，说明分片文件上传结束。
    for (let idx = await computedBreakPointProgressHandler(calculationHashCode, step); idx < chunks.length; idx += 1) {
        const {chunk, chunkFileName} = chunks[idx];

        // 表示 formData 参数
        const formData = new FormData();
        formData.append("file", chunk);
        const res = await sectionUploadReq(calculationHashCode, chunkFileName, formData);

        // 判断是否写入成功
        if (res.success) {
            // 修改 上传中的状态
            emitUploadingProgressState(UploadProgressState.Uploading, uniqueCode, step);
        } else {

            // 一旦执行到这里，说明上传失败了。尝试重新上传
        }
    }

    // 修改状态 为 合并状态
    emitUploadProgressState(UploadProgressState.Merge, uniqueCode);

    // 开始尝试合并文件
    const extName = globalInfoMapping[uniqueCode].get("extName")!;
    const res = await mergeUploadReq(calculationHashCode, `${calculationHashCode}.${extName}`);
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

    // 添加并且发射任务, 每次添加一个文件，就会发射文件
    pLimit.firingTask(task);
}

/**
 * 表示上传的事件
 *
 * @author lihh
 * @param uploadFile 表示上传的文件
 */
export function uploadHandler(
    uploadFile: File,
): Promise<string> {
    return new Promise(function (resolve) {
        // 每个文件分配一个code，唯一的code
        const uniqueCode = generateUniqueCode();

        // 表示文件名称
        const {name: fileName, size: fontSize} = uploadFile;
        // 表示文件后缀
        const extName = fileName.split(".").shift()!;
        // 将属性设置为全局属性，方便获取
        putGlobalInfoMappingHandler(uniqueCode, "fileName", fileName, "uniqueCode", uniqueCode, "fontSize", fontSize, "extName", extName);
        // 修改状态
        emitUploadProgressState(UploadProgressState.Prepare, uniqueCode);

        resolve("");

        // 判断是否加载 worker
        if (isNotEmpty(calculateNameWorker.current)) {
            // 将 上传的文件 发送给 webWorker 来计算hash
            calculateNameWorker.current!.postMessage(uploadFile);
            // 添加订阅事件
            calculateNameWorker.current!.onmessage = async function (event) {
                const calculationHashName = event.data;
                // 修改状态为 等待状态
                emitUploadProgressState(UploadProgressState.Waiting, uniqueCode);
                // 开始上传文件
                await startUploadFileHandler(uploadFile, calculationHashName, uniqueCode);
            }
        } else {
            throw new Error("web worker not supported");
        }
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
    calculateUploaderConfig.current = Object.assign({}, uploaderDefaultConfig, config);
}
