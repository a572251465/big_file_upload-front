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
    // 表示 类型
    type: UploadProgressState;
    // 表示 唯一标识
    code: string;
    // 表示 步长
    step: number;
    // 表示 总步长, 文件切割多少份
    totalSize: number;
    // 表示 进度
    progress: number;
    // 表示 块 标记
    blockMark: string;
    // 表示 上传文件名称
    fileName: string;
}>;

/* 队列元素 */
export type QueueElementRequired = Required<Omit<QueueElementBase, "progress" | "total" | "step">>;

/* 基础 必输类型 */
export type QueueElementTypeRequired = Omit<QueueElementBase, "type"> &
    Pick<QueueElementBase, "type">;

/* 表示 current 类型 */
export interface CurrentType<T = null> {
    current: T;
}
