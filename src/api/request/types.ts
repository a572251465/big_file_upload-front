/* 请求枚举相关的 value */
export enum REQUEST_ENUM_VALUE {
  "REQUEST_HEADERS",
  "REQUEST_URL",
  "RESPONSE_CODE",
}

/* request 请求方式 */
export enum REQUEST_METHOD_VALUE {
  "get" = "get",
  "post" = "post",
  "delete" = "delete",
  "patch" = "PATCH",
}

/* request 初期化参数 */
export type RequestInitializeParams = Partial<{ urlPrefix: string }>;

export type ICommonResponse<T = unknown> = {
  data: T;
  message: string;
  success: boolean;
  code: number;
};

export type IPageInfo<T = unknown> = {
  pageNumber: number;
  pageSize: number;
  totalRow: number;
  totalPage: number;
  records: T;
};
