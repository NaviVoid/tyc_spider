const dotenv = require("dotenv");
const util = require("util");
const nodeHtmlParser = require("node-html-parser");
const { Company, Inv, close } = require("./db");
dotenv.config();

const mongoose = require("mongoose");
mongoose.connect(process.env.db || "", {
  keepAlive: true,
  keepAliveInitialDelay: 300000,
});

const fetch_tags = async (cid: number) => {
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

      await Company.updateOne({ cid }, { tags });
    } catch (e) {
      console.log(`fetch tags error for ${cid}: ${e}`);
    }
  } else {
    console.log(`didn't get html page for ${cid}`);
  }
};

const fetch_one = async (cid: number, timestamp: number, token: string) => {
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

      infos.forEach(async (row: any) => {
        try {
          await Company.findOneAndUpdate(
            { cid: row.cid },
            {
              name: row.name,
              alias: row.alias,
              percent: row.percent,
              legal_person_id: row.legalPersonId,
              legal_person_name: row.legalPersonName,
              reg_status: row.regStatus,
              legal_type: row.legalType,
              reg_capital: row.regCapital,
            },
            {
              upsert: true,
            }
          );
        } catch (err) {
          if (err)
            console.log(`${row.cid} ${row.name} upsert company error: ${err}`);
        }

        try {
          await Inv.findOneAndUpdate(
            { owner: cid, cid: row.cid },
            {
              percent: row.percent,
            },
            {
              upsert: true,
            }
          );
        } catch (err) {
          if (err)
            console.log(
              `${row.cid} ${row.name} upsert inv for ${cid} error: ${err}`
            );
        }

        await fetch_tags(row.cid);
      });

      return;
    }

    console.log(`api call for ${cid} returns ${util.inspect(res)}`);
  } else {
    console.log(`api call for ${cid} returns null`);
  }
};

const run = async () => {
  const ts = new Date().getTime();
  const token: string = process.env.token || "";
  await fetch_one(38575694, ts, token);
  await fetch_tags(38575694);
};

(async function () {
  await run();
  close();
})();
