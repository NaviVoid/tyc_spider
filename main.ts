import mongoose from "mongoose";
import util from "util";
import nodeHtmlParser from "node-html-parser";
import { Company, Inv } from "./db.js";
import { randomInt } from "crypto";
import Koa from "koa";
import fs from "fs";

const NAMES: string[] = fs.readFileSync("./names.txt").toString().split("\n");

const sleep = (time: number) => {
  return new Promise((resolve) =>
    setTimeout(resolve, time + randomInt(time / 2))
  );
};

const fetch_tags = async (cid: number, withOther = false, depth = 1) => {
  const url = `https://www.tianyancha.com/company/${cid}`;

  const headers = {
    Host: "www.tianyancha.com",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
  };

  const response = await fetch(url, { method: "GET", headers });
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

      // 需要获取基本信息的公司基本是开始的根节点公司
      if (withOther) {
        const person_html =
          html.querySelector(`script#__NEXT_DATA__`)?.innerText;
        if (!person_html) {
          console.log(
            `${"  ".repeat(depth - 1)}fetch tags withOther for ${cid} failed`
          );
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
              console.log(
                `${"  ".repeat(
                  depth - 1
                )}fetch tags withOther for ${cid} failed: no data in query`
              );
            } else {
              await Company.findOneAndUpdate(
                { cid },
                {
                  name: res.name,
                  alias: res.alias,
                  legal_person_id: res.legalPersonId,
                  legal_person_name: res.legalPersonName,
                  reg_status: res.regStatus,
                  legal_type: res.legalPersonType,
                  reg_capital: res.regCapital,
                },
                {
                  upsert: true,
                }
              );
            }
          } else {
            console.log(
              `${"  ".repeat(
                depth - 1
              )}fetch tags withOther for ${cid} failed: no queries in json`
            );
          }
        }
      }

      if (tags) {
        if (code) {
          await Company.updateOne({ cid }, { tags, listing, code });
        }
        await Company.updateOne({ cid }, { tags, listing });
        console.log(
          `${"  ".repeat(depth - 1)}${cid} has tags: ${tags}, code: ${code}`
        );
      } else {
        console.log(`${"  ".repeat(depth - 1)}${cid} html: ${html}`);
      }
    } catch (e) {
      console.log(`${"  ".repeat(depth - 1)}fetch tags error for ${cid}: ${e}`);
    }
  } else {
    console.log(`${"  ".repeat(depth - 1)}didn't get html page for ${cid}`);
  }
};

const fetch_one = async (
  cid: number,
  timestamp: number,
  token: string,
  depth = 1
) => {
  const cpy = await Company.findOne({ cid });
  if (!cpy?.name) {
    console.log(`${cid} not exists`);
    return;
  }

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
  if (response.status !== 200) {
    console.log(
      `${"  ".repeat(depth - 1)}fetch one for ${
        cpy?.name
      } request failed with code: ${response.status}`
    );
    return;
  }

  const res = await response.json();
  if (res?.data?.list) {
    const rows = res["data"]["list"];
    if (rows.length) {
      const infos = rows
        .map((row: any) => {
          if (!row.cid) {
            return;
          }

          return {
            cid: row.cid,
            name: row.name,
            alias: row.alias,
            percent: parseFloat(row.percent.replace("%", "")),
            legal_person_id: row.legalPersonId,
            legal_person_name: row.legalPersonName,
            reg_status: row.regStatus,
            legal_type: row.legalType,
            reg_capital: row.regCapital,
          };
        })
        .filter((row: object | undefined) => row);

      if (infos.length) {
        // 删除以前存储的投资关系
        await Inv.deleteMany({ owner: cid });
      }

      console.log(
        `${"  ".repeat(depth - 1)}${cpy?.name} has ${infos.length} invests`
      );

      for (const row of infos) {
        try {
          await Company.findOneAndUpdate(
            { cid: row.cid },
            {
              name: row.name,
              alias: row.alias,
              legal_person_id: row.legal_person_id,
              legal_person_name: row.legal_person_name,
              reg_status: row.reg_status,
              legal_type: row.legal_type,
              reg_capital: row.reg_capital,
            },
            {
              upsert: true,
            }
          );
        } catch (err) {
          if (err) console.log(`${row.name} upsert company error: ${err}`);
        }

        try {
          await Inv.findOneAndUpdate(
            { owner: cid, cid: row.cid },
            {
              percent: row.percent,
              owner_name: cpy?.name || "",
              name: row.name,
            },
            {
              upsert: true,
            }
          );
        } catch (err) {
          if (err)
            console.log(
              `${row.name} upsert inv for ${cpy?.name} error: ${err}`
            );
        }

        await fetch_tags(row.cid);
        await sleep(8000);
      }

      // 进入下一层
      if (depth < 3) {
        for (const row of infos) {
          console.log(
            `${"  ".repeat(depth - 1)}${row.name} fetch in depth: ${depth + 1}`
          );
          await fetch_one(row.cid, timestamp, token, depth + 1);
        }
      }

      return;
    }

    if (rows.length !== 0) {
      console.log(
        `${"  ".repeat(depth - 1)}api call for ${
          cpy?.name
        } returns ${util.inspect(res)}`
      );
    }
  } else {
    console.log(
      `${"  ".repeat(depth - 1)}api call for ${cpy?.name} returns null`
    );
  }
};

const update = async (name: string, token: string) => {
  const ts = new Date().getTime();
  const cid = await search_by_name(name, token, ts);
  console.log(`${name} got cid: ${cid}`);
  if (!cid) {
    return;
  }

  await sleep(2);
  await fetch_tags(cid, true);
  await fetch_one(cid, ts, token);
  return cid;
};

interface InvInterface {
  cid: number;
  pct: number;
  owner: string;
  owner_tags: string[];
  owner_listing: number;
  name: string;
  tags: string[];
  listing: number;
}

const save_one_csv = async (cid: number) => {
  try {
    const level1_invs: InvInterface[] = (
      await Inv.aggregate([
        { $match: { owner: cid } },
        {
          $lookup: {
            from: `companies`,
            localField: `cid`,
            foreignField: `cid`,
            as: `company`,
          },
        },
        {
          $lookup: {
            from: `companies`,
            localField: `owner`,
            foreignField: `cid`,
            as: `owner`,
          },
        },
      ])
    ).map((row) => {
      return {
        cid: row.cid,
        pct: row.percent || 0,
        owner: row.owner[0].name,
        owner_tags: row.owner[0].tags,
        owner_listing: row.owner[0].listing,
        name: row.company[0].name,
        tags: row.company[0].tags,
        listing: row.company[0].listing,
      };
    });

    if (level1_invs.length > 0) {
      let lines: string[] = [];

      for (const lv1_inv of level1_invs) {
        const lv1_line = `${lv1_inv.owner},${lv1_inv.owner_tags.join(" ")},${
          lv1_inv.owner_listing
        },${lv1_inv.pct},${lv1_inv.name},${lv1_inv.tags.join(" ")},${
          lv1_inv.listing
        }`;

        const lv2_invs = (
          await Inv.aggregate([
            { $match: { owner: lv1_inv.cid } },
            {
              $lookup: {
                from: `companies`,
                localField: `cid`,
                foreignField: `cid`,
                as: `company`,
              },
            },
            {
              $lookup: {
                from: `companies`,
                localField: `owner`,
                foreignField: `cid`,
                as: `owner`,
              },
            },
          ])
        ).map((row) => {
          return {
            cid: row.cid,
            pct: row.percent || 0,
            owner: row.owner[0].name,
            owner_tags: row.owner[0].tags,
            owner_listing: row.owner[0].listing,
            name: row.company[0].name,
            tags: row.company[0].tags,
            listing: row.company[0].listing,
          };
        });

        if (lv2_invs.length > 0) {
          for (const lv2_inv of lv2_invs) {
            const lv2_line = `${lv1_line},${lv2_inv.pct},${
              lv2_inv.name
            },${lv2_inv.tags.join(" ")},${lv2_inv.listing}`;

            const lv3_invs = (
              await Inv.aggregate([
                { $match: { owner: lv2_inv.cid } },
                {
                  $lookup: {
                    from: `companies`,
                    localField: `cid`,
                    foreignField: `cid`,
                    as: `company`,
                  },
                },
                {
                  $lookup: {
                    from: `companies`,
                    localField: `owner`,
                    foreignField: `cid`,
                    as: `owner`,
                  },
                },
              ])
            ).map((row) => {
              return {
                cid: row.cid,
                pct: row.percent || 0,
                owner: row.owner[0].name,
                owner_tags: row.owner[0].tags,
                owner_listing: row.owner[0].listing,
                name: row.company[0].name,
                tags: row.company[0].tags,
                listing: row.company[0].listing,
              };
            });

            if (lv3_invs.length > 0) {
              const lv3_lines = lv3_invs.map(
                (lv3_inv) =>
                  `${lv2_line},${lv3_inv.pct},${
                    lv3_inv.name
                  },${lv3_inv.tags.join(" ")},${lv3_inv.listing}`
              );
              lines = lines.concat(lv3_lines);
            } else {
              lines.push(lv2_line);
            }
          }
        } else {
          lines.push(lv1_line);
        }
      }

      fs.writeFileSync("./res.csv", lines.join("\n") + "\n", { flag: "a" });
    }
  } catch (err) {
    console.log(`save csv for ${cid} failed: ${err}`);
  }
};

const save_csv_header = () => {
  fs.writeFileSync(
    "./res.csv",
    "company,tag,listing,pct,company,tag,listing,pct,company,tag,listing,pct,company,tag,listing\n",
    {
      flag: "w",
    }
  );
};

const search_by_name = async (
  name: string,
  token: string,
  timestamp: number
) => {
  const url = `https://capi.tianyancha.com/cloud-tempest/search/suggest/v3?_=${timestamp}`;

  const headers = {
    "X-AUTH-TOKEN": token,
    Host: "capi.tianyancha.com",
    Origin: "https://www.tianyancha.com",
    Referer: "https://www.tianyancha.com",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
    version: "TYC-Web",
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    mode: "cors",
    body: JSON.stringify({ keyword: name }),
  });
  if (response.status !== 200) {
    console.log(
      `search for ${name} request failed with code: ${response.status}`
    );
    return;
  }
  const j_data = await response.json();
  const data = j_data?.data;
  if (!data || !data.length) {
    console.log(
      `search for ${name} request failed with response: ${util.inspect(j_data)}`
    );
    return;
  }

  const cid = data[0]?.id;
  if (!cid) {
    console.log(`search for ${name} request failed with data: ${data[0]}`);
    return;
  }

  return cid;
};

const start_fetch = async (token: string) => {
  console.log(`token: ${token}`);
  save_csv_header();

  try {
    for (const name of NAMES) {
      console.log(`update ${name} start`);
      const cid = await update(name, token);
      console.log(`update ${name} done`);
      if (cid) {
        await save_one_csv(cid);
        await sleep(10000);
      }
    }
  } catch (err) {
    console.log(err);
  }
};

const start_srv = async () => {
  await mongoose.connect(process.env.mongodb || "", {
    keepAlive: true,
    keepAliveInitialDelay: 300000,
  });
  console.log(`connect to mongodb`);

  const app = new Koa();

  app.use(async (ctx) => {
    switch (ctx.request.URL.pathname) {
      case `/update`:
        const token = ctx.request.query?.token;
        if (typeof token === "string") {
          await start_fetch(token || "");
        } else if (token) {
          await start_fetch(token[0] || "");
        }
        break;
      default:
        break;
    }

    ctx.body = "ok";
  });

  const port = 8000;
  const srv = app.listen(port, () => {
    console.log(`listening on: ${port}`);
  });

  const cleanup = () => {
    srv.close(async () => {
      await mongoose.connection.close();
      console.log(`disconnect from mongodb`);
      process.exit();
    });
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
};

await start_srv();
