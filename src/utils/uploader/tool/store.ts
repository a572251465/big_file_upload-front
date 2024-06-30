import localforage from "localforage";

/* 设置 配置参数 */
localforage.config({
    storeName: "big_file_upload",
    driver: localforage.INDEXEDDB
});

/**
 * 删除 item 事件
 *
 * @author lihh
 * @param key 主键 key
 */
function deleteItemHandler(key: string) {

}

/**
 * 拿到全部的item
 *
 * @author lihh
 */
function getAllItemHandler(): Array<Record<string, Array<unknown>>> {
    return [];
}

/**
 * 添加 item事件
 *
 * @author lihh
 * @param key 添加的 key
 * @param value value 的集合
 */
function addItemHandler(key: string, value: Array<unknown>) {

}

/**
 * 表示全局的store hook
 *
 * @author lihh
 */
export function useStore(): [typeof addItemHandler, typeof deleteItemHandler, typeof getAllItemHandler] {
    return [addItemHandler, deleteItemHandler, getAllItemHandler];
}