import mongoose from "mongoose";

const InvSchema = new mongoose.Schema({
  owner: { type: Number, required: true },
  cid: { type: Number, required: true },
  percent: Number,
  updated_at: { type: Date, required: true, default: Date.now },
});

InvSchema.index({ owner: 1, cid: 1 }, { unique: true });

const CompanySchema = new mongoose.Schema({
  cid: { type: Number, index: true, unique: true, required: true },
  legal_person_id: Number,
  code: { type: String, index: true },
  reg_status: String,
  estiblish_time: Date,
  legal_type: Number,
  reg_capital: String,
  name: { type: String, required: true },
  alias: String,
  legal_person_name: String,
  tags: [String],
  listing: { type: Number, required: true, default: 0 },
  updated_at: { type: Date, required: true, default: Date.now },
  invs_done: { type: Boolean, required: true, default: false }, // 投资关系是否更新结束了
  info_done: { type: Boolean, required: true, default: false }, // 基本信息是否更新结束了
});

const Company = mongoose.model("Company", CompanySchema);
const Inv = mongoose.model("Inv", InvSchema);

export { Company, Inv };
