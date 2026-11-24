const fs = require("fs");
const path = require("path");
const vm = require("vm");

if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
  globalThis.crypto = require("crypto").webcrypto;
}

const source = fs.readFileSync(path.join(__dirname, "walz.js"), "utf8");

const sandbox = {
  module: { exports: {} },
  exports: {},
  crypto: globalThis.crypto,
  Buffer,
  Uint8Array,
  ArrayBuffer,
  DataView,
  URL,
  URLSearchParams,
  setTimeout,
  clearTimeout,
  btoa: (s) => Buffer.from(String(s), "binary").toString("base64"),
  atob: (s) => Buffer.from(String(s), "base64").toString("binary"),
  TextEncoder,
  TextDecoder,
  console
};

if (typeof globalThis.fetch === "function") {
  sandbox.fetch = globalThis.fetch.bind(globalThis);
}

sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(
  source + "\nif (typeof WADetector !== 'undefined') { module.exports = WADetector; } else if (exports && Object.keys(exports).length) { module.exports = exports; }",
  sandbox,
  { filename: "walz.js", timeout: 30000 }
);

module.exports = sandbox.module.exports;
