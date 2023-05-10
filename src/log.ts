import winston from "winston";

const LOG_DIR = "./logs";

const logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  transports: [
    new winston.transports.File({
      filename: `${LOG_DIR}/app.log`,
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.prettyPrint()
      ),
    }),
    new winston.transports.File({
      filename: `${LOG_DIR}/error.log`,
      level: "error",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.prettyPrint()
      ),
    }),
  ],
});

export default logger;
