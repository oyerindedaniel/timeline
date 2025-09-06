/**
 * Logger utility that only logs in development mode
 */

const isDev = process.env.NODE_ENV === "development";

const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info("%c[INFO]", "color: #007acc", ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  debug: (message: string, data?: unknown) => {
    if (isDev) {
      console.log(
        "%c[DEBUG] " + message,
        "background: #222; color: #bada55",
        data || ""
      );
    }
  },
  format: (message: string, data?: unknown) => {
    if (isDev) {
      console.log(
        "%c[FORMAT] " + message,
        "background: #553399; color: #ffffff",
        data || ""
      );
    }
  },
};
export default logger;
