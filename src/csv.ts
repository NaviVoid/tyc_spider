import log from "./log";
import fs from "fs";
import { Inv } from "./db";

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

const load_level = async (cid: number): Promise<InvInterface[]> => {
  const invs: InvInterface[] = (
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
  return invs;
};

const save_one_csv = async ({ cid, name }: { cid: number; name: string }) => {
  try {
    const lv1_invs = await load_level(cid);

    if (lv1_invs.length > 0) {
      let lines: string[] = [];

      for (const lv1_inv of lv1_invs) {
        const lv1_line = `${lv1_inv.owner},${lv1_inv.owner_tags.join(" ")},${
          lv1_inv.owner_listing
        },${lv1_inv.pct},${lv1_inv.name},${lv1_inv.tags.join(" ")},${
          lv1_inv.listing
        }`;

        const lv2_invs = await load_level(lv1_inv.cid);

        if (lv2_invs.length > 0) {
          for (const lv2_inv of lv2_invs) {
            const lv2_line = `${lv1_line},${lv2_inv.pct},${
              lv2_inv.name
            },${lv2_inv.tags.join(" ")},${lv2_inv.listing}`;

            const lv3_invs = await load_level(lv2_inv.cid);

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

      fs.writeFileSync("./txts/res.csv", lines.join("\n") + "\n", {
        flag: "a",
      });
    }
  } catch (err) {
    log.error(`[save_one_csv] save csv for ${name} failed: ${err}`);
  }
};

const save_csv_header = () => {
  fs.writeFileSync(
    "./txts/res.csv",
    "company,tag,listing,pct,company,tag,listing,pct,company,tag,listing,pct,company,tag,listing\n",
    {
      flag: "w",
    }
  );
};

export { save_one_csv, save_csv_header };
