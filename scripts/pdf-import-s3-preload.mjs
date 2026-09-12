import https from "node:https";
import http from "node:http";
import { syncBuiltinESMExports } from "node:module";
const original = https.request;
https.request = function (options, ...args) {
  if (
    typeof options === "object" &&
    String(options.hostname ?? options.host).endsWith(
      "octavo223.r2.cloudflarestorage.com",
    )
  ) {
    return http.request(
      {
        ...options,
        protocol: "http:",
        hostname: "127.0.0.1",
        host: "127.0.0.1",
        port: 19923,
        agent: false,
      },
      ...args,
    );
  }
  return original.call(this, options, ...args);
};
syncBuiltinESMExports();
