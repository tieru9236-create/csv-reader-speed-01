// csv-reader 1.0.0, the house entry, make.fun's own reference program: run(input) is make.fun's own csv-reader 1.0.0's readCsv, called as its tree ships it
// (vendor/csv-reader/, make.fun's own code with its LICENSE and NOTICE; SOURCE.txt says what it derives from).
// An entry exports the same run from a module of its own, which must return the same answer for every input.

import * as lib from "./vendor/csv-reader/index.js";

const fn = lib["readCsv"] ?? (lib.default != null && typeof lib.default["readCsv"] === 'function' ? lib.default["readCsv"].bind(lib.default) : undefined);
if (typeof fn !== 'function') throw new Error("csv-reader 1.0.0 exports no function readCsv from index.js");

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  return fn(input);
}
