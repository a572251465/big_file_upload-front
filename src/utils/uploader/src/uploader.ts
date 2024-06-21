import {
    calculateNameWorker,
    emitUploadProgressState,
    putGlobalInfoMappingHandler
} from "./utils/tools";
import {isNotEmpty} from "jsmethod-extra";
import {UploadProgressState} from "./types";

/**
 * 开始上传文件
 *
 * @author lihh
 * @param file 要上传的文件
 * @param hashName 根据文件 生成 hashName
 */
export function startUploadFileHandler(file: File, hashName: string) {

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
        const fileName = uploadFile.name, {blockMark, code} = otherInfo;
        // 将属性设置为全局属性，方便获取
        putGlobalInfoMappingHandler(code, "fileName", fileName, "blockMark", blockMark, "code", code);

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
                startUploadFileHandler(uploadFile, hashCode);
            }
        } else {
            throw new Error("web worker not supported");
        }
    });
}
