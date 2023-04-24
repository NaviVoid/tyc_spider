// GET https://capi.tianyancha.com/cloud-equity-provider/v4/hold/companyholding?_=1681978517131&id=3097983719&pageSize=100&pageNum=1
// X-AUTH-TOKEN: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxMzY4ODgwNTM4MiIsImlhdCI6MTY4MTk3ODIxNywiZXhwIjoxNjg0NTcwMjE3fQ.RTN0dASZr7Vc8g7rIMrK3nALA95WnCc6HNUzT2cwE2Wm7zI9a45nzZh1_vCDyx0RPan8r4hufDe981EbmZqhQw
// Host: capi.tianyancha.com
// Origin: https://www.tianyancha.com
// Referer: https://www.tianyancha.com/
// User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36
// version: TYC-Web

const fetch_one = async (cid: number, timestamp: number, token: string) => {
  console.log(cid);
  console.log(timestamp);
  console.log(token);

  const url = `https://capi.tianyancha.com/cloud-equity-provider/v4/hold/companyholding?_=${timestamp}&id=${cid}&pageSize=100&pageNum=1`;

  const headers = {
    "X-AUTH-TOKEN": token,
    Host: "capi.tianyancha.com",
    Origin: "https://www.tianyancha.com",
    Referer: "https://www.tianyancha.com",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
    version: "TYC-Web",
  };

  const response = await fetch(url, { method: "GET", headers, mode: "cors" });

  console.log(await response.json());
};

const run = async () => {
  const ts = new Date().getTime();
  const token = `eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxMzY4ODgwNTM4MiIsImlhdCI6MTY4MTk3ODIxNywiZXhwIjoxNjg0NTcwMjE3fQ.RTN0dASZr7Vc8g7rIMrK3nALA95WnCc6HNUzT2cwE2Wm7zI9a45nzZh1_vCDyx0RPan8r4hufDe981EbmZqhQw`;
  await fetch_one(3097983719, ts, token);
};

await run();

export {};
