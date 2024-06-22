import {api, ICommonResponse} from "../request"

/**
 * 切割文件 上传
 *
 * @param baseDir 表示基础目录
 * @param fileName 文件名称
 * @param formData file 文件
 */
export function sectionUploadReq(baseDir: string, fileName: string, formData: FormData) {
    return api.post<ICommonResponse>(`/upload/section/${baseDir}/${fileName}`, formData);
}

/**
 * merge 合并上传的文件
 *
 * @author lihh
 * @param baseDir 表示基础目录
 * @param fileName 文件名称
 */
export function mergeUploadReq(baseDir: string, fileName: string) {
    return api.get<ICommonResponse>(`/upload/merge/${baseDir}/${fileName}`);
}

/**
 * 验证文件 是否存在
 *
 * @author lihh
 * @param fileName 文件名称
 */
export function verifyFileExistReq(fileName: string) {
    return api.get<ICommonResponse>(`/upload/verify/${fileName}`);
}

/**
 * 获取文件列表
 *
 * @author lihh
 * @param baseDir 基础目录
 */
export function listFilesReq(baseDir: string) {
    return api.get<ICommonResponse<Array<string>>>(`/upload/list/${baseDir}`);
}