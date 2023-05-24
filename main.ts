import log from "./src/log";
import mongoose from "mongoose";
import run from "./src/rev";
import fs from "fs";

const NAMES: string[] = fs
  .readFileSync("./txts/comp.txt")
  .toString()
  .split("\n")
  .filter((row) => row !== "");

(async () => {
  await mongoose.connect(process.env.mongodb || "", {
    keepAlive: true,
    keepAliveInitialDelay: 300000,
  });
  log.info(`connect to mongodb`);
  const token = `eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxOTEzNjM0MzEzNyIsImlhdCI6MTY4NDgyNTQ2MywiZXhwIjoxNjg3NDE3NDYzfQ.0HtNE0AI_7L7g7JYBLywDZ3awhfn7fhQ0uWBXVRuKUSLkKFWkMNxH5XJLxEzsw7AmdJTJ3zf6qIbFPqMT0bbAw`;
  await run(token, NAMES);
  await mongoose.connection.close();
  log.info(`disconnect from mongodb`);
})();
