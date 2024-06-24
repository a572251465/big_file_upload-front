import {
    addPrefix,
    equals,
    isEmpty,
    isFormData,
    isFunction,
    valueOrDefault,
} from "jsmethod-extra";
import {
    ICommonResponse,
    REQUEST_ENUM_VALUE,
    REQUEST_METHOD_VALUE,
    RequestInitializeParams,
} from "./types";
import {assign} from "@/utils";

const baseInitConfig: RequestInitializeParams = {
    urlPrefix: "",
};

export class Request {
    // 订阅池
    private subscribePool: Map<REQUEST_ENUM_VALUE, any> = new Map();
    // 基础的配置文件
    private baseConfig: RequestInitializeParams = {};

    /**
     * 通过静态方法 拿到类 实例
     *
     * @param config 基础config 参数
     */
    static getInstance(config?: RequestInitializeParams) {
        const request = new Request();
        request.baseConfig = assign(
            {},
            baseInitConfig,
            request.baseConfig,
            valueOrDefault(config, {}),
        );
        return request;
    }

    subscribe(key: REQUEST_ENUM_VALUE, callback: any) {
        this.subscribePool.set(key as REQUEST_ENUM_VALUE, callback);
    }

    /**
     * 针对url 处理
     *
     * @author lihh
     * @param url 设置的url
     * @private
     */
    private forUrlProcessing(url: string): string {
        url = addPrefix(url, valueOrDefault(this.baseConfig.urlPrefix!, ""));
        const fn = this.subscribePool.get(REQUEST_ENUM_VALUE.REQUEST_URL);
        if (isFunction(fn)) url = fn(url);

        return url;
    }

    /**
     * 针对请求的headers 进行处理
     *
     * @author lihh
     * @param targetHeaders 原来传递的headers
     * @private
     */
    private forHeadersProcessing(targetHeaders: Headers | null): Headers {
        // 如果传递的header为空的话，设置 new Headers() 实例
        if (isEmpty(targetHeaders)) targetHeaders = new Headers();

        // 拿到 订阅的 headers
        const fn = this.subscribePool.get(REQUEST_ENUM_VALUE.REQUEST_HEADERS);
        if (isFunction(fn)) {
            // 执行函数 返回将要应用的配置
            const willUseConfig = valueOrDefault(fn() as Record<string, string>, {});
            for (const willUseConfigKey in willUseConfig)
                targetHeaders!.set(willUseConfigKey, willUseConfig[willUseConfigKey]);
        }
        return targetHeaders!;
    }

    /**
     * 针对请求返回值 进行处理
     *
     * @author lihh
     * @param code 返回的请求 code
     * @private
     */
    private forCodeProcessing(code: number): boolean {
        const fn = this.subscribePool.get(REQUEST_ENUM_VALUE.RESPONSE_CODE);
        if (isFunction(fn)) {
            return fn(code);
        }
        return true;
    }

    /**
     * 核心的请求方式
     *
     * @param method 请求方式
     * @param url 请求path
     * @param body 请求body
     * @param headers 请求headers
     * @private
     */
    private fetch<T extends ICommonResponse>(
        method: REQUEST_METHOD_VALUE,
        url: string,
        body: BodyInit | null,
        headers: Headers | null,
    ) {
        return new Promise<T>((resolve, reject) => {
            /* 针对url 处理 */
            url = this.forUrlProcessing(url);
            /* 针对header 做处理 */
            headers = this.forHeadersProcessing(headers);
            // 设置请求类型
            if (!isFormData(body)) headers.set("Content-Type", "application/json");
            try {
                fetch(url, {
                    method,
                    headers,
                    mode: "cors",
                    body: equals(method, REQUEST_METHOD_VALUE.get) ? null : body,
                }).then(async (res) => {
                    if (res.ok) {
                        const result = await res.json();

                        /* 针对code做处理 */
                        const state = this.forCodeProcessing(result.code);
                        if (!state) return;

                        resolve(result as unknown as T);
                    } else reject();
                });
            } catch (e) {
                reject(e);
                /* empty */
            }
        });
    }

    /* 重写的post方法 */
    post<T extends ICommonResponse>(url: string): Promise<T>;
    post<T extends ICommonResponse>(url: string, body: BodyInit): Promise<T>;
    post<T extends ICommonResponse>(
        url: string,
        body: BodyInit,
        headers: Headers,
    ): Promise<T>;
    post<T extends ICommonResponse>(
        url: string,
        body?: BodyInit,
        headers?: Headers,
    ): Promise<T> {
        return this.fetch<T>(
            REQUEST_METHOD_VALUE.post,
            url,
            body || null,
            headers || null,
        );
    }

    get<T extends ICommonResponse>(url: string) {
        return this.fetch<T>(REQUEST_METHOD_VALUE.get, url, null, null);
    }

    /* 重写del 方法 */
    del<T extends ICommonResponse>(url: string): Promise<T>;
    del<T extends ICommonResponse>(url: string, body: BodyInit): Promise<T>;
    del<T extends ICommonResponse>(url: string, body?: BodyInit): Promise<T> {
        return this.fetch<T>(
            REQUEST_METHOD_VALUE.delete,
            url,
            valueOrDefault(body, null) as BodyInit | null,
            null,
        );
    }

    /* 重写patch 方法 */
    patch<T extends ICommonResponse>(url: string): Promise<T>;
    patch<T extends ICommonResponse>(url: string, body: BodyInit): Promise<T>;
    patch<T extends ICommonResponse>(
        url: string,
        body: BodyInit,
        headers: Headers,
    ): Promise<T>;
    patch<T extends ICommonResponse>(
        url: string,
        body?: BodyInit,
        headers?: Headers,
    ): Promise<T> {
        return this.fetch<T>(
            REQUEST_METHOD_VALUE.patch,
            url,
            body || null,
            headers || null,
        );
    }
}
