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