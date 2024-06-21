import { Request } from "./Request";
import { REQUEST_ENUM_VALUE } from "./types";
import { addPrefix, isEmpty } from "jsmethod-extra";

const api = Request.getInstance();

api.subscribe(REQUEST_ENUM_VALUE.REQUEST_URL, function (url: string) {
  if (isEmpty(url)) return url;
  return addPrefix(url, import.meta.env.VITE_PROXY_PREFIX!);
});

export { api };
export * from "./types";
