/* 进度状态 */
export enum UploadProgressState {
    // 准备中 计算唯一的hash码
    Prepare = "Prepare",
    // 上传等待中 目的是为了并发控制
    Waiting = "Waiting",
    // 上传中
    Uploading = "Uploading",
    // 表示合并文件中
    Merge = "Merge",
    // 上传完成
    Done = "Done",
    // 秒传
    QuickUpload = "QuickUpload",
    // 断点 续传
    BreakPointUpload = "BreakPointUpload",
    // 表示 其他元素上传中
    OtherUploading = "OtherUploading"
}

/* 分割文件类型 */
export interface ChunkFileType {
    chunk: Blob;
    chunkFileName: string
}

/* 队列元素 */
export type QueueElementBase = Partial<{
    // 类型
    type: UploadProgressState;
    // 唯一标识
    uniqueCode: string;
    // 文件大小
    fileSize: number,
    // 步长
    step: number;
    // 进度
    progress: number;
    // 文件名称
    fileName: string;
}>;

/* 上传文件的 配置文件 */
export type UploadConfigType = {
    // 最大重试次数
    maxRetryTimes: number,
    // 并发限制次数
    concurrentLimit: number
}

/* 队列元素 */
export type QueueElementRequired = Required<Omit<QueueElementBase, "progress" | "step">>;

/* 基础 必输类型 */
export type QueueElementTypeRequired = Omit<QueueElementBase, "type"> &
    Pick<QueueElementBase, "type">;

/* 表示 current 类型 */
export interface CurrentType<T = null> {
    current: T;
}
