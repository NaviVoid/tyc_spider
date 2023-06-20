import { Inv, Company } from "./db";
import log from "./log";

// 记录投资的 _id 防止环
let INV_RECORDS: string[] = [];

const get_percent = async (cid: number, fund_cids: number[]) => {
  const lv1_funds = (await Inv.find({ cid })).filter(
    (inv) => INV_RECORDS.indexOf(inv._id.toString()) === -1
  );
  if (lv1_funds.length === 0) {
    return [];
  }

  INV_RECORDS = INV_RECORDS.concat(lv1_funds.map((inv) => inv._id.toString()));

  const funds = lv1_funds.filter((fund) => fund_cids.indexOf(fund.cid) !== -1);
  const infos = funds.map((fund) => {
    return { owner: fund.owner, percent: fund.percent };
  });

  // 继续向上查
  const next_funds = lv1_funds.filter(
    (fund) => fund_cids.indexOf(fund.cid) === -1
  );

  log.info(
    `[inv_csv] ${cid} has ${funds.length} funds, ${next_funds.length} next funds`
  );

  for (const fund of next_funds) {
    log.info(`[inv_csv] ${cid} look for next ${fund.owner} funds`);

    const next_infos = await get_percent(fund.owner, fund_cids);
    for (const next_info of next_infos) {
      infos.push({
        owner: next_info.owner,
        percent: fund.percent * next_info.percent,
      });
    }
    log.info(
      `[inv_csv] ${cid} look for next ${fund.owner} funds has ${next_infos.length} results`
    );
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
    INV_RECORDS = [];
    log.info(`[inv_csv] ${cid} begin`);
    const inv_infos = await get_percent(cid, fund_cids);
    log.info(inv_infos);
    log.info(`[inv_csv] ${cid} end`);
  }
};

export default run;
