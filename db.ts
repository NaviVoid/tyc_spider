import mongoose from "mongoose";

const InvSchema = new mongoose.Schema({
  owner_name: { type: String, required: true },
  name: { type: String, required: true },
  owner: { type: Number, required: true },
  cid: { type: Number, required: true },
  percent: Number,
});

InvSchema.index({ owner: 1, cid: 1 }, { unique: true });

const CompanySchema = new mongoose.Schema({
  cid: { type: Number, index: true, unique: true, required: true },
  legal_person_id: Number,
  reg_status: String,
  estiblish_time: Date,
  legal_type: Number,
  reg_capital: String,
  name: { type: String, required: true },
  alias: String,
  legal_person_name: String,
  tags: [String],
});

const Company = mongoose.model("Company", CompanySchema);
const Inv = mongoose.model("Inv", InvSchema);

export { Company, Inv };
