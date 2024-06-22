import {UploadProgressState} from "../types";
import {calculateChunkSize} from "./tools"; /* 上传进度状态文字 */

/* 上传进度状态文字 */
export const UploadProgressStateText: Record<
    Required<UploadProgressState>,
    string
> = {
    [UploadProgressState.Prepare]: "准备中 ...",
    [UploadProgressState.Waiting]: "排队等待中 ...",
    [UploadProgressState.Uploading]: "切片文件 上传中 ...",
    [UploadProgressState.Merge]: "文件合并中 ...",
    [UploadProgressState.Done]: "完成",
    [UploadProgressState.QuickUpload]: "秒传成功",
    [UploadProgressState.BreakPointUpload]: "断点续传 准备中 ...",
    [UploadProgressState.OtherUploading]: "相同的文件上传中 ...",
    [UploadProgressState.Canceled]: "上传被取消",
    [UploadProgressState.Pause]: "上传已暂停",
    [UploadProgressState.Retry]: "上传失败, 重试中(%s) ...",
    [UploadProgressState.RetryFailed]: "重试失败, 上传被取消"
};

/* 计算 chunk size 大小，这是一个预估值 */
export const CHUNK_SIZE_30 = calculateChunkSize(30);
export const CHUNK_SIZE_100 = calculateChunkSize(100);
/* 上传的文件 订阅状态 */
export const UPLOADING_FILE_SUBSCRIBE_DEFINE = "UPLOADING_FILE_SUBSCRIBE_DEFINE";
