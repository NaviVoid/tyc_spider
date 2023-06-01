import log from "./src/log";
import mongoose from "mongoose";
import rev from "./src/rev";
import fet from "./src/app";
import save_csv from "./src/csv";
import rev_csv from "./src/rev_csv";
import fs from "fs";

(async () => {
  await mongoose.connect(process.env.mongodb || "", {
    keepAlive: true,
    keepAliveInitialDelay: 300000,
  });
  log.info(`connect to mongodb`);
  const token = `eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxOTEzNjM0MzEzNyIsImlhdCI6MTY4NDgyNTQ2MywiZXhwIjoxNjg3NDE3NDYzfQ.0HtNE0AI_7L7g7JYBLywDZ3awhfn7fhQ0uWBXVRuKUSLkKFWkMNxH5XJLxEzsw7AmdJTJ3zf6qIbFPqMT0bbAw`;

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
