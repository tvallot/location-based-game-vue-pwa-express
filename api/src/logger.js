import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { config } from "./config.js";

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message }) => `${timestamp} ${level}: ${message}`),
);

function createLogger(fileName) {
  if (config.isTest) {
    return winston.createLogger({ silent: true, transports: [new winston.transports.Console()] });
  }

  return winston.createLogger({
    level: "info",
    format,
    transports: [
      new winston.transports.Console(),
      new DailyRotateFile({
        dirname: config.logDir,
        filename: `${fileName}-%DATE%.log`,
        datePattern: "YYYY-MM-DD",
        maxFiles: "14d",
      }),
    ],
  });
}

export const accessLogger = createLogger("access");
export const gameLogger = createLogger("game");
