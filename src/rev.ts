import util from "util";
import nodeHtmlParser from "node-html-parser";
import { Company, Inv } from "./db";
import { try_fetch, sleep } from "./req";
import { save_csv_header, save_chain_csv } from "./csv";
import log from "./log";

interface Cpy {
  cid: number;
  name: string;
}

const fetch_infos = async ({ cid, name }: Cpy) => {
  const url = `https://www.tianyancha.com/company/${cid}`;

  const headers = {
    Host: "www.tianyancha.com",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
  };
  const response = await try_fetch(url, "GET", headers, "no-cors", null);
  if (!response) {
    log.error(`[fetch_infos] invalid response for ${name}`);
    return;
  }

  const text = await response.text();

  if (text) {
    try {
      const html = nodeHtmlParser.parse(text);
      const tags = html
        .querySelectorAll(`div[class^=index_company-tag]`)
        .map((elem: any) => elem.firstChild.innerText.trim());
      const listing_text =
        html.querySelector(`div[class^=index_lv1-root]`)?.textContent || "";
      const listing = listing_text.indexOf("上市信息") === -1 ? 0 : 1;

      const script_code =
        html.querySelector(`script#__NEXT_DATA__`)?.innerText || "";
      const code_match = script_code.match(/"creditCode":"(\w+)",/);
      let code = "";
      if (code_match?.length && code_match.length > 1) {
        code = code_match[1];
      }

      let info = {};

      const person_html = html.querySelector(`script#__NEXT_DATA__`)?.innerText;
      if (!person_html) {
        log.info(`[fetch_infos] fetch infos for ${cid} failed`);
      } else {
        const data =
          JSON.parse(person_html)?.props?.pageProps?.dehydratedState?.queries;
        if (data && data.length) {
          const query = data.filter((row: any) => {
            return (
              row.queryHash ===
              `[\"/cloud-other-information/companyinfo/baseinfo/web\",{\"id\":\"${cid}\"}]`
            );
          });

          const res = query.pop()?.state?.data?.data;
          if (!res) {
            log.error(
              `[fetch_infos] fetch infos for ${name} failed: no data in query`
            );
          } else {
            info = {
              alias: res.alias,
              legal_person_id: res.legalPersonId,
              legal_person_name: res.legalPersonName,
              reg_status: res.regStatus,
              legal_type: res.legalPersonType,
              reg_capital: res.regCapital,
            };
          }
        } else {
          log.error(
            `[fetch_infos] fetch infos for ${name} failed: no queries in json`
          );
        }
      }

      log.info(
        `[fetch_infos] ${name} tags: ${tags}, code: ${code}, listing: ${listing}`
      );
      return {
        tags,
        code,
        listing,
        info,
      };
    } catch (e) {
      log.error(`[fetch_infos] fetch tags error for ${name}: ${e}`);
    }
  } else {
    log.error(`[fetch_infos] didn't get html page for ${name}`);
  }
};

const fetch_holder = async (
  { cid, name }: Cpy,
  timestamp: number,
  token: string,
  depth = 1
) => {
  const url = `https://capi.tianyancha.com/cloud-company-background/companyV2/dim/holderForWeb?_=${timestamp}`;

  const headers = {
    "X-AUTH-TOKEN": token,
    Host: "capi.tianyancha.com",
    Origin: "https://www.tianyancha.com",
    Referer: "https://www.tianyancha.com/",
    Accept: "application/json, text/plain, */*",
    Connection: "keep-alive",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
    version: "TYC-Web",
    "Content-type": "application/json",
  };

  const response = await try_fetch(
    url,
    "POST",
    headers,
    "no-cors",
    JSON.stringify({
      pageSize: 100,
      pageNum: 1,
      gid: cid.toString(),
      percentLevel: -100,
      sortField: "capitalAmount",
      sortType: -100,
    }),
    true
  );
  if (!response) {
    log.error(`[fetch_holder] invalid response for ${name}`);
    return;
  }

  const res = await response.json();
  if (res?.data?.result) {
    const rows = res["data"]["result"];
    if (rows.length) {
      const holders = rows
        .map((row: any) => {
          // 只保留持股公司
          if (!row.id || !row.type || row.type !== 1) {
            return;
          }

          return {
            cid: row.id,
            name: row.name,
            percent: row.percent,
          };
        })
        .filter((row: object | undefined) => row);

      if (holders.length === 0) {
        log.info(`[fetch_holder] [depth:${depth}] ${name} has no holders`);
        return;
      }

      // 可能存在投资环, 检查已存在投资关系的更新时间
      const old_inv = await Inv.findOne({ owner: holders[0].cid, cid });
      if (old_inv && old_inv.percent) {
        log.info(`[fetch_holder] [depth:${depth}] ${name} circle done.`);
        return;
      }

      // 删除以前存储的投资关系
      await Inv.deleteMany({ cid });

      log.info(
        `[fetch_holder] [depth:${depth}] ${name} has ${holders.length} holders`
      );

      const holders_to_go = [];

      for (const row of holders) {
        const infos = await fetch_infos({ cid: row.cid, name: row.name });
        if (!infos) {
          log.error(`[fetch_holder] ${row.name} empty info`);
          continue;
        }

        await Company.findOneAndUpdate(
          { cid: row.cid },
          {
            ...infos.info,
            code: infos.code,
            listing: infos.listing,
            tags: infos.tags,
            info_done: true,
          }
        );
        log.info(
          `[fetch_holder] [depth:${depth}] ${name} upsert company ${row.name}`
        );

        await Inv.findOneAndUpdate(
          { owner: row.cid, cid },
          {
            percent: row.percent,
          },
          {
            upsert: true,
          }
        );
        log.info(
          `[fetch_holder] [depth:${depth}] ${name} upsert inv ${row.name}`
        );

        // 排除掉上市公司
        if (infos.listing === 0) {
          holders_to_go.push({
            cid: row.cid,
            name: row.name,
            percent: row.percent,
          });
        }

        await sleep(9000);
      }

      // 进入下一层
      for (const row of holders_to_go) {
        log.info(`[fetch_holder] [depth:${depth}] ${row.name} fetch holders`);

        const infos = await fetch_infos(row);
        if (!infos) {
          log.error(`[fetch_holder] ${row.name} empty info`);
          continue;
        }

        await Company.findOneAndUpdate(
          { cid: row.cid },
          {
            ...infos.info,
            code: infos.code,
            listing: infos.listing,
            tags: infos.tags,
            info_done: true,
          }
        );
        log.info(
          `[fetch_holder] [depth:${depth}] ${name} upsert company ${row.name}`
        );

        await sleep(2000);

        try {
          await fetch_holder(
            { cid: row.cid, name: row.name },
            timestamp,
            token,
            depth + 1
          );

          log.info(
            `[fetch_holder] [depth:${depth}] ${row.name} fetch holders done`
          );
        } catch (err) {
          log.error(
            `[fetch_holder] [depth:${depth}] ${row.name} fetch holders error: ${err}`
          );
          continue;
        }
      }
      return;
    }

    if (rows.length !== 0) {
      log.error(
        `[fetch_holder] [depth:${depth}] api call for ${name} returns ${util.inspect(
          res
        )}`
      );
    }
  } else {
    log.error(
      `[fetch_holder] [depth:${depth}] api call for ${name} returns null`
    );
  }
};

/**
 * 更新投资关系
 * @param sname 公司名字
 * @param token
 * @returns
 */
const update = async (
  sname: string,
  token: string
): Promise<{ cid: number; name: string } | undefined> => {
  const date = new Date();
  const ts = date.getTime();

  let cpy = await Company.findOne({ sname });

  // 数据库未存储该公司
  if (!cpy) {
    const res = await search_by_name(sname, ts);
    if (!res) {
      return;
    }

    const { cid, name } = res;
    log.info(`[update] ${name} got cid: ${cid}`);

    // 使用精准 cid 查询是否已经存储
    cpy = await Company.findOne({ cid });
    if (!(cpy && cpy.updated_at)) {
      cpy = await new Company({ cid, name, listing: 0 }).save();
    }
  }

  // 更新时间检查
  if (
    cpy?.updated_at &&
    cpy?.updated_at.toISOString().slice(0, 10) >=
      date.toISOString().slice(0, 10) &&
    cpy?.invs_done
  ) {
    return { cid: cpy.cid, name: cpy.name };
  }

  cpy.info_done = false;
  cpy = await cpy.save();

  await sleep(2000);

  if (cpy.listing === 1) {
    log.info(`[update] ${cpy.name} is listed`);
    return { cid: cpy.cid, name: cpy.name };
  }

  try {
    await fetch_holder(cpy, ts, token);
  } catch (err) {
    log.error(`[update] ${cpy.name} fetch holders error: ${err}`);
    return;
  }

  return { cid: cpy.cid, name: cpy.name };
};

/**
 * 访问搜索接口, 用公司名获取 cid
 * @param name 公司名
 * @param timestamp 当前时间戳
 * @returns cid 与 标准公司名
 */
const search_by_name = async (
  name: string,
  timestamp: number
): Promise<{ cid: number; name: string } | undefined> => {
  const url = `https://capi.tianyancha.com/cloud-tempest/search/suggest/v3?_=${timestamp}`;

  const headers = {
    Host: "capi.tianyancha.com",
    Origin: "https://www.tianyancha.com",
    Referer: "https://www.tianyancha.com",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
    version: "TYC-Web",
    "Content-Type": "application/json",
    Accept: "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Sec-Ch-Ua": `"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"`,
    "Sec-Ch-Ua-Mobile": `?0`,
    "Sec-Ch-Ua-Platform": "macOS",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-site",
  };

  const response = await try_fetch(
    url,
    "POST",
    headers,
    "cors",
    JSON.stringify({ keyword: name })
  );

  if (!response) {
    log.error(`[search_by_name] invalid response for ${name}`);
    return;
  }

  const j_data = await response.json();
  const data = j_data?.data;
  if (!data || !data.length) {
    log.error(
      `[search_by_name] search for ${name} request failed with response: ${util.inspect(
        j_data
      )}`
    );
    return;
  }

  const cid = data[0]?.id;
  const comName = data[0]?.comName;
  if (!cid || !comName) {
    log.error(
      `[search_by_name] search for ${name} request failed with data: ${data[0]}`
    );
    return;
  }

  return { cid, name: comName };
};

/**
 * 检查所有公司的基本信息并更新
 */
const update_all_infos = async () => {
  const companies = await Company.where({ info_done: false });
  for (const company of companies) {
    await sleep(10000);
    log.info(`[update_all_infos] ${company.name} start`);
    const infos = await fetch_infos(company);
    if (!infos) {
      log.error(`[update_all_infos] ${company.name} empty info`);
      continue;
    }

    await Company.findOneAndUpdate(
      { cid: company.cid },
      {
        ...infos.info,
        code: infos.code,
        listing: infos.listing,
        tags: infos.tags,
        info_done: true,
      }
    );
    log.info(`[update_all_infos] ${company.name} done`);
  }
};

/**
 * 最后运行的检测和打印日志
 */
const after_fetch = async () => {
  const invs_not_done = await Company.where({ invs_done: false });
  for (const company of invs_not_done) {
    log.error(`[after_fetch] ${company.name} invs not done`);
  }

  const info_not_done = await Company.where({ info_done: false });
  for (const company of info_not_done) {
    log.error(`[after_fetch] ${company.name} info not done`);
  }
};

/**
 * 使用 token 和 save_point 开始爬取
 * 将会跳过 save_point 以及之前的公司
 * @param token 账号 token
 * @param NAMES 公司名字
 */
const start_fetch = async (token: string, NAMES: string[]) => {
  log.info(`[start_fetch] token: ${token}"`);
  // const cpys = (await Company.find({ listing: 0 }, { name: 1 })).map(
  //   (doc) => doc.name
  // );
  // 重新开始则覆盖写入 header
  // if (cpys.length === 0) {
  //   save_csv_header();
  // }

  // 更新完毕可以写入 csv 的公司
  const cids: { cid: number; name: string }[] = [];

  for (const name of NAMES) {
    try {
      log.info(`[start_fetch] update ${name} start`);
      const res = await update(name, token);
      log.info(`[start_fetch] update ${name} done`);
      if (res) {
        cids.push(res);
      }
    } catch (err) {
      // 实在会出错的先跳过, 之后整理名单放到最后重新爬取
      log.error(`[start_fetch] failed for ${name} error: ${err}`);
      continue;
    }
  }

  await update_all_infos();

  // for (const { cid, name } of cids) {
  //   await save_chain_csv({ cid, name });
  //   log.info(`[start_fetch] save ${name} to csv done`);
  //   await sleep(100);
  // }

  await after_fetch();
};

export default start_fetch;
