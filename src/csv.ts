import fs from "fs";
import { Company, Inv } from "./db";

const RECORDS: string[] = [];

interface InvInterface {
  _id: string;
  cid: number;
  pct: number;
  name: string;
  tags: string[];
  listing: number;
}

const load_level = async (owner: number): Promise<InvInterface[]> => {
  const invs: InvInterface[] = (
    await Inv.aggregate([
      { $match: { owner } },
      {
        $lookup: {
          from: `companies`,
          localField: `cid`,
          foreignField: `cid`,
          as: `company`,
        },
      },
    ])
  ).map((row) => {
    return {
      _id: row._id.toString(),
      cid: row.cid,
      pct: row.percent || 0,
      name: row.company[0].name,
      tags: row.company[0].tags,
      listing: row.company[0].listing,
    };
  });
  return invs;
};

const inv_to_rows = async (owner: number): Promise<string[]> => {
  const invs = await load_level(owner);
  if (invs.length === 0) {
    return [""];
  }

  let lines: string[] = [];

  for (const inv of invs) {
    if (RECORDS.indexOf(inv._id) !== -1) {
      continue;
    }

    const prefix = `${inv.name},${inv.tags.join(" ")},${inv.listing}`;
    const rows = (await inv_to_rows(inv.cid)).map((row) => `${prefix},${row}`);
    lines = lines.concat(rows);
    RECORDS.push(inv._id);
  }
  return lines;
};

const get_one_rows = async (owner: number) => {
  let lines: string[] = [];
  const cpy = await Company.findOne({ cid: owner });
  const prefix = `${cpy?.name},${cpy?.tags.join(" ")},${cpy?.listing}`;

  const top_lv_invs = await Inv.find({ owner });

  if (top_lv_invs.length === 0) {
    return [prefix];
  }

  for (const inv of top_lv_invs) {
    console.log(`processing invs: ${cpy?.name} => ${inv.cid}`);
    const rows = (await inv_to_rows(inv.cid)).map((row) => `${prefix},${row}`);
    lines = lines.concat(rows);
  }
  return lines;
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

const save_csv_rows = (rows: string[]) => {
  fs.writeFileSync("./txts/res.csv", rows.join("\n") + "\n", {
    flag: "a",
  });
};

const chain_csv = async (cid: number): Promise<string[]> => {
  const cpy = await Company.findOne({ cid });
  console.log(`processing: ${cpy?.name}`);

  if (!cpy) {
    return [];
  }
  return await get_one_rows(cpy.cid);
};

const save_csv = async () => {
  save_csv_header();

  const root_cpys: number[] = (
    await Company.aggregate([
      {
        $lookup: {
          from: "Invs",
          foreignField: "cid",
          localField: "cid",
          as: "invs",
        },
      },
      {
        $project: {
          cid: "$cid",
          inv_len: { $size: "$invs" },
        },
      },
      {
        $match: {
          inv_len: 0,
        },
      },
    ])
  ).map((cpy) => cpy.cid);

  for (const cid of root_cpys) {
    const rows = await chain_csv(cid);
    if (rows.length) {
      save_csv_rows(rows);
    }
  }
};

export default save_csv;
