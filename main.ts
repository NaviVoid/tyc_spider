import mongoose from "mongoose";
import dotenv from "dotenv";
import util from "util";
import nodeHtmlParser from "node-html-parser";
import { Company, Inv } from "./db.js";
import { randomInt } from "crypto";
import fs from "fs";
dotenv.config();

const MAX_DEPTH = 3;
const CSV_FILE = `./res.csv`;
const CIDS = [
  3097983719, 1834977, 5332516171, 10000203432, 2344229885, 3479518807,
  449614599, 730214534, 3269002394, 3290645689,
];

const sleep = (time: number) => {
  return new Promise((resolve) =>
    setTimeout(resolve, time + randomInt(time / 2))
  );
};

/**
 * 访问html网页获取标签
 * @param cid
 * @param withOther 是否在html上获取公司信息, 用于无法从api里获取的公司
 * @param depth 当前为第几层递归
 */
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
        await Company.updateOne({ cid }, { tags });
        console.log(`${"  ".repeat(depth - 1)}${cid} has tags: ${tags}`);
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
      if (depth < MAX_DEPTH) {
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

const update = async (cid: number) => {
  const ts = new Date().getTime();
  const token: string = process.env.token || "";
  if (token === "") {
    console.log(`invalid token`);
    return;
  }

  await fetch_tags(cid, true);
  await fetch_one(cid, ts, token);
};

interface InvInterface {
  cid: number;
  pct: number;
  owner: string;
  name: string;
}

const save_csv = async () => {
  await mongoose.connect(process.env.db || "", {
    keepAlive: true,
    keepAliveInitialDelay: 300000,
  });

  fs.writeFileSync(CSV_FILE, "company,pct,company,pct,company,pct,company\n", {
    flag: "w",
  });

  for (const cid of CIDS) {
    try {
      const level1_invs: InvInterface[] = (await Inv.find({ owner: cid })).map(
        (row) => {
          return {
            cid: row.cid,
            pct: row.percent || 0,
            owner: row.owner_name,
            name: row.name,
          };
        }
      );

      if (level1_invs.length > 0) {
        let lines: string[] = [];

        for (const lv1_inv of level1_invs) {
          const lv1_line = `${lv1_inv.owner},${lv1_inv.pct},${lv1_inv.name}`;

          const lv2_invs = (
            await Inv.find({
              owner: lv1_inv.cid,
            })
          ).map((row) => {
            return {
              cid: row.cid,
              pct: row.percent || 0,
              name: row.name,
            };
          });

          if (lv2_invs.length > 0) {
            for (const lv2_inv of lv2_invs) {
              const lv2_line = `${lv1_line},${lv2_inv.pct},${lv2_inv.name}`;

              const lv3_invs = (
                await Inv.find({
                  owner: lv2_inv.cid,
                })
              ).map((row) => {
                return {
                  cid: row.cid,
                  pct: row.percent || 0,
                  name: row.name,
                };
              });

              if (lv3_invs.length > 0) {
                const lv3_lines = lv3_invs.map(
                  (lv3_inv) => `${lv2_line},${lv3_inv.pct},${lv3_inv.name}`
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

        fs.writeFileSync(CSV_FILE, lines.join("\n") + "\n", { flag: "a" });
      }
    } catch (err) {
      console.log(`save csv for ${cid} failed: ${err}`);
      continue;
    }
  }

  await mongoose.connection.close();
};

const run = async () => {
  const action = process.argv.at(2);
  if (!action) {
    return;
  }

  await mongoose.connect(process.env.db || "", {
    keepAlive: true,
    keepAliveInitialDelay: 300000,
  });

  if (action === "update") {
    try {
      for (const cid of CIDS) {
        console.log(`update ${cid} start`);
        await update(cid);
        console.log(`update ${cid} done`);
        await sleep(10000);
      }
    } catch (err) {
      console.log(err);
    } finally {
      await mongoose.connection.close();
    }
  } else {
    await save_csv();
  }
};

await run();
