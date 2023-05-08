import mongoose from "mongoose";

const InvSchema = new mongoose.Schema({
  owner: { type: Number, required: true },
  cid: { type: Number, required: true },
  percent: Number,
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
});

const Company = mongoose.model("Company", CompanySchema);
const Inv = mongoose.model("Inv", InvSchema);

export { Company, Inv };
