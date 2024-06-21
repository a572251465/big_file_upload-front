import {isEmpty} from "jsmethod-extra";

interface IFn {
    (...args: any[]): any;
}

const saveRecords: Record<string, IFn[]> = {};

/**
 * @author lihh
 * @description 进行订阅
 * @param type 订阅类型
 * @param fn 订阅方法
 * @returns
 */
const on = (type: string, fn: IFn) => {
    const fns = saveRecords[type] || (saveRecords[type] = []);
    if (fns.includes(fn)) return;

    fns.push(fn);
};

/**
 * @author lihh
 * @description 将订阅的函数进行触发
 * @param type 触发类型
 * @param args 剩余参数
 */
const emit = (type: string, ...args: unknown[]) => {
    const fns = saveRecords[type] || (saveRecords[type] = []);
    fns.forEach((fn) => fn(...args));
};

/**
 * @author lihh
 * @description 取消订阅
 * @param type 类型
 */
const off = (type: string) => {
    if (isEmpty(type))
        throw new Error(`off function params【type】 is not empty`);
    const keys: string[] = [type];
    keys.forEach((name: string) => {
        if (saveRecords[name]) Reflect.deleteProperty(saveRecords, name);
    });
};

export const emitterAndTaker = {on, emit, off};
