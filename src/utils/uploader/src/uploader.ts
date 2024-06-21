import {
    calculateNameWorker,
    emitUploadingProgressState,
    emitUploadProgressState,
    putGlobalInfoMappingHandler
} from "./utils/tools";
import {isNotEmpty} from "jsmethod-extra";
import {ChunkFileType, UploadProgressState} from "./types";
import {createFileChunks, PLimit} from "@/utils/uploader";
import {sectionUploadReq} from "@/api/upload";

// 表示 并发限制
const pLimit = PLimit.getInstance(3);

/**
 * 表示生成任务
 *
 * @author lihh
 * @param baseDir 表示基础目录
 * @param code 唯一的code
 * @param chunks 分割的文件
 */
export async function generateTask(baseDir: string, code: string, chunks: Array<ChunkFileType>) {
    // 表示 步长
    const step = (100 / chunks.length) | 0;

    for (let i = 0; i < chunks.length; i++) {
        const {chunk, chunkFileName} = chunks[i];

        // 表示 formData 参数
        const formData = new FormData();
        formData.append("file", chunk);
        const res = await sectionUploadReq(baseDir, chunkFileName, formData);
        // 判断是否写入成功
        if (res.success) {
            // 修改 上传中的状态
            emitUploadingProgressState(UploadProgressState.Uploading, code, step);
        }
    }
}

/**
 * 开始上传文件
 *
 * @author lihh
 * @param file 要上传的文件
 * @param hashName 根据文件 生成 hashName
 * @param idenCode 身份凭证 code
 */
export function startUploadFileHandler(file: File, hashName: string, idenCode: string) {
    // 将 文件分为多份
    const fileChunks = createFileChunks(file, hashName);
    // 开始生成任务
    const task = generateTask.bind(null, hashName.split(".").shift()!, idenCode, fileChunks);

    // 添加并且发射任务
    pLimit.firingTask(task);
}

/**
 * 表示上传的事件
 *
 * @author lihh
 * @param uploadFile 表示上传的文件
 * @param otherInfo 其他信息 包括blockMark 文件所属模块 / code 唯一标识 / publicPath 二级目录
 */
export function uploadHandler(
    uploadFile: File,
    otherInfo: {
        blockMark: string,
        code: string,
        publicPath?: string
    },
): Promise<string> {
    return new Promise(function (resolve) {
        // 表示文件名称
        const {name: fileName, size: totalSize} = uploadFile, {
            blockMark,
            code
        } = otherInfo;
        // 将属性设置为全局属性，方便获取
        putGlobalInfoMappingHandler(code, "fileName", fileName, "blockMark", blockMark, "code", code, "totalSize", totalSize);

        // 修改状态
        emitUploadProgressState(UploadProgressState.Prepare, code);

        resolve("");

        // 判断是否加载 worker
        if (isNotEmpty(calculateNameWorker.current)) {
            // 将 上传的文件 发送给 webWorker 来计算hash
            calculateNameWorker.current!.postMessage(uploadFile);
            // 添加订阅事件
            calculateNameWorker.current!.onmessage = function (event) {
                const hashCode = event.data;
                // 修改状态为 等待状态
                emitUploadProgressState(UploadProgressState.Waiting, code);
                // 开始上传文件
                startUploadFileHandler(uploadFile, hashCode, code);
            }
        } else {
            throw new Error("web worker not supported");
        }
    });
}
