import log from "./src/log";
import mongoose from "mongoose";
import run from "./src/app";
import fs from "fs";

const NAMES: string[] = fs
  .readFileSync("./txts/names.txt")
  .toString()
  .split("\n")
  .filter((row) => row !== "");

(async () => {
  await mongoose.connect(process.env.mongodb || "", {
    keepAlive: true,
    keepAliveInitialDelay: 300000,
  });
  log.info(`connect to mongodb`);
  const token = `eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxOTEzNjM0MzEzNyIsImlhdCI6MTY4MzUzMzM5MywiZXhwIjoxNjg2MTI1MzkzfQ.DqnU71jHIgLM_fVVI3wJ3Pp169js1pkFHQaDCGN5zuM4g6ARZuw4soqD9tB-eAQB8Y3R2v7MvhWZ1k3ObjTqzw`;
  await run(token, "", NAMES);
  await mongoose.connection.close();
  log.info(`disconnect from mongodb`);
})();
