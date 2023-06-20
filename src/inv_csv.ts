import { Inv, Company } from "./db";
import log from "./log";

const INV_RECORDS: string[] = [];

const get_percent = async (cid: number, fund_cids: number[]) => {
  const lv1_funds = await Inv.find({ cid });
  if (lv1_funds.length === 0) {
    return [];
  }

  const funds = lv1_funds.filter((fund) => fund_cids.indexOf(fund.cid) !== -1);
  const infos = funds.map((fund) => {
    return { owner: fund.owner, percent: fund.percent };
  });

  // 继续向上查
  const next_funds = lv1_funds.filter(
    (fund) => fund_cids.indexOf(fund.cid) === -1
  );

  for (const fund of next_funds) {
    const next_infos = await get_percent(fund.cid, fund_cids);
    for (const next_info of next_infos) {
      infos.push({
        owner: next_info.owner,
        percent: fund.percent * next_info.percent,
      });
    }
  }

  return infos;
};

/**
 * 生成被母基金列表投资的公司们投资比例和信息
 *
 * @param names 母基金名字
 */
const run = async (names: string[]) => {
  // 母基金公司
  const funds = await Company.find({ name: { $in: names } });
  log.info(`[inv_csv] funds: ${funds.length}`);

  // 查询所有被投资的公司
  const fund_cids = funds.map((fund) => fund.cid);
  const cpy_cids = (
    await Inv.find({ owner: { $in: fund_cids } }, { cid: 1 })
  ).map((inv) => inv.cid);

  log.info(`[inv_csv] companies: ${cpy_cids.length}`);

  for (const cid of cpy_cids) {
    const inv_infos = await get_percent(cid, fund_cids);

    log.info(inv_infos);
  }
};

export default run;
