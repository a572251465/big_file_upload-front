import {isFunction, isUndefined} from "jsmethod-extra";
import {
    clearCacheStateHandler,
    emitterAndTaker,
    globalDoneCallbackMapping,
    globalInfoMapping,
    globalPauseStateMapping,
    globalProgressState,
    progressNormalOrErrorCompletionHandler,
    restartUploadFileHandler,
    REVERSE_CONTAINER_ACTION,
    sameFileNeedProceedHandler,
    SubscriberSort,
    UPLOADING_FILE_SUBSCRIBE_DEFINE
} from "@/utils";
import {QueueElementBase, UploadProgressState} from "./types";
import {emitUploadProgressState} from "./tools";

emitterAndTaker.on(
    REVERSE_CONTAINER_ACTION,
    async function (uniqueCode: string, action: UploadProgressState) {
        // 判断 动作是否合法
        if (
            ![UploadProgressState.Pause, UploadProgressState.Canceled].includes(
                action,
            ) ||
            !globalProgressState.current.has(uniqueCode)
        )
            return;

        // 同时 修改状态
        globalProgressState.current.set(uniqueCode, action);

        switch (action) {
            case UploadProgressState.Canceled:
                emitUploadProgressState(UploadProgressState.Canceled, uniqueCode);
                break;
            case UploadProgressState.Pause: {
                // 是否已经被暂停了
                const isPaused = globalPauseStateMapping.current.get(uniqueCode);
                if (!isUndefined(isPaused))
                    await restartUploadFileHandler(
                        uniqueCode,
                        UploadProgressState.PauseRetry,
                    );
                break;
            }
        }
    },
);

// 订阅事件【UPLOADING_FILE_SUBSCRIBE_DEFINE】，每个状态改变 都会执行这个方法
emitterAndTaker.on(
    UPLOADING_FILE_SUBSCRIBE_DEFINE,
    async function (el: QueueElementBase) {
        // 同时订阅 判断指定的状态
        switch (el.type) {
            case UploadProgressState.RetryFailed:
            case UploadProgressState.Done:
            case UploadProgressState.Canceled:
            case UploadProgressState.QuickUpload:
                // 某个文件结束的时候，判断是否有相同的文件等待
                if (
                    [UploadProgressState.Done, UploadProgressState.QuickUpload].includes(
                        el.type,
                    )
                )
                    await sameFileNeedProceedHandler(el.uniqueCode!);

                progressNormalOrErrorCompletionHandler(el);
                clearCacheStateHandler(el.uniqueCode!);
                break;
            // 这里是暂停处理
            case UploadProgressState.Pause:
                // 设置暂停状态
                if (!globalPauseStateMapping.current.has(el.uniqueCode!))
                    globalPauseStateMapping.current.set(el.uniqueCode!, el.pauseIndex!);
        }
    }, SubscriberSort.FIRST, 10
);

/**
 * 当 el 类型是 Done or QuickUpload 的时候监听
 *
 * @author lihh
 */
emitterAndTaker.on(UPLOADING_FILE_SUBSCRIBE_DEFINE, async function (el: QueueElementBase) {
    // 判断是否为 done or quickUpload
    switch (el.type) {
        case UploadProgressState.Done:
        case UploadProgressState.QuickUpload:
            const map = globalInfoMapping[el.uniqueCode!],
                calculationHashName = map.get("calculationHashName")!,
                pMethods = globalDoneCallbackMapping.current.get(el.uniqueCode!);

            // 这里是执行 promise resolve 方法 以及 callback方法
            const [m1, , m3] = pMethods!;
            if (isFunction(m1))
                m1(calculationHashName);
            if (isFunction(m3))
                m3(calculationHashName);
            break;
    }
}, SubscriberSort.FIRST, 5);