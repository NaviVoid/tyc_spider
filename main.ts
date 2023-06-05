import log from "./src/log";
import mongoose from "mongoose";
import rev from "./src/rev";
import fet from "./src/app";
import save_csv from "./src/csv";
import rev_csv from "./src/rev_csv";
import fs from "fs";

(async () => {
  const token = process.env.token || "";
  if (!token) {
    log.info(`need token`);
    return;
  }

  await mongoose.connect(process.env.mongodb || "", {
    keepAlive: true,
    keepAliveInitialDelay: 300000,
  });
  log.info(`connect to mongodb`);

  const action = process.env.action || "";
  if (action === "update") {
    const names: string[] = fs
      .readFileSync("./txts/names.txt")
      .toString()
      .split("\n")
      .filter((row) => row !== "");
    await fet(token, names);
  } else if (action === "rev") {
    const names: string[] = fs
      .readFileSync("./txts/rev.txt")
      .toString()
      .split("\n")
      .filter((row) => row !== "");
    await rev(token, names);
  } else if (action === "rev_csv") {
    await rev_csv();
  } else {
    await save_csv();
  }

  await mongoose.connection.close();
  log.info(`disconnect from mongodb`);
})();
