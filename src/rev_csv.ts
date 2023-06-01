import fs from "fs";
import { Company, Inv } from "./db";

const RECORDS: string[] = [];

interface InvInterface {
  _id: string;
  owner: number;
  pct: number;
}

const load_level = async (cid: number): Promise<InvInterface[]> => {
  const invs: InvInterface[] = (
    await Inv.find({ cid }, { owner: 1, percent: 1 })
  ).map((row) => {
    return {
      _id: row._id.toString(),
      owner: row.owner,
      pct: row.percent || 0,
    };
  });
  return invs;
};

const inv_to_rows = async (cid: number, p: string) => {
  const cpy = await Company.findOne({ cid });
  const prefix = `${p},${cpy?.name},${cpy?.tags.join(" ")},${cpy?.listing}`;
  const invs = await load_level(cid);
  if (invs.length === 0) {
    save_csv_rows([prefix]);
    return;
  }

  for (const inv of invs) {
    if (RECORDS.indexOf(inv._id) !== -1) {
      continue;
    }

    await inv_to_rows(inv.owner, prefix);
    RECORDS.push(inv._id);
  }
};

const get_one_rows = async (cpy: any) => {
  const prefix = `${cpy.name},${cpy?.tags.join(" ")},${cpy.listing}`;
  const top_lv_invs = await Inv.find({ cid: cpy.cid });

  if (top_lv_invs.length === 0) {
    save_csv_rows([prefix]);
    return;
  }

  for (const inv of top_lv_invs) {
    console.log(`processing invs: ${cpy.name} => ${inv.owner}`);
    await inv_to_rows(inv.owner, prefix);
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

const save_csv_rows = (rows: string[]) => {
  fs.writeFileSync("./txts/res.csv", rows.join("\n") + "\n", {
    flag: "a",
  });
};

const chain_csv = async (cid: number) => {
  const cpy = await Company.findOne({ cid });
  if (!cpy) {
    return [];
  }
  console.log(`processing: ${cpy?.name}`);
  await get_one_rows(cpy);
};

const save_csv = async () => {
  save_csv_header();

  const names: string[] = fs
    .readFileSync("./txts/rev.txt")
    .toString()
    .split("\n")
    .filter((row) => row);

  const root_cpys: number[] = (
    await Company.find({ name: { $in: names } })
  ).map((cpy) => cpy.cid);

  for (const cid of root_cpys) {
    await chain_csv(cid);
  }
};

export default save_csv;
