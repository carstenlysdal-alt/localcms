/* eslint-disable @typescript-eslint/no-require-imports */
// Preload (node --require) til tests, som kører udenfor Next:
//  - `server-only` er et Next-alias uden fysisk pakke i node_modules -> peg på en tom fil.
//  - CSS-importer i klientkomponenter (import "./x.css") ignoreres, så server-komponenter der importerer dem kan indlæses.
const Module = require("node:module");
const path = require("node:path");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return path.join(__dirname, "empty.js");
  return original.call(this, request, ...rest);
};
require.extensions[".css"] = () => undefined;
