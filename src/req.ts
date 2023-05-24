import log from "./log";
import { randomInt } from "crypto";

const try_fetch = async (
  url: string,
  method: "GET" | "POST",
  headers: HeadersInit | undefined,
  mode: RequestMode,
  body: BodyInit | null | undefined,
  keepalive: boolean | undefined = undefined
) => {
  let counter = 0;

  while (counter < 5) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        mode,
        body,
        keepalive,
      });
      if (response.status === 200) {
        return response;
      }
      if (response.status === 400) {
        return;
      }
      log.error(
        `[try_fetch] fetch status: ${response.status}, ${method} "${url}"`
      );
    } catch (err) {
      log.error(`[try_fetch] fetch error: ${err}, ${method} "${url}"`);

      // 非 timeout 错误直接结束
      //@ts-ignore
      if (!(err?.code && err?.code === `UND_ERR_CONNECT_TIMEOUT`)) {
        return;
      }
    }

    counter += 1;
    await sleep(1000);
    log.error(`[try_fetch] fetch retry: ${counter}, ${method} "${url}"`);
  }
};

const sleep = (time: number) => {
  return new Promise((resolve) =>
    setTimeout(resolve, time + randomInt(time / 2))
  );
};

export { try_fetch, sleep };
