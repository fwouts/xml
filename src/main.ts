import * as fs from "fs";
import * as path from "path";
import { format } from "./xml/formatter";
import { tokenize } from "./xml/lexer";
import { parse } from "./xml/parser";

const DEBUG = false;

if (process.argv.length <= 2) {
  console.error(`Please specify a path to an XML file.`);
  process.exit(1);
}

const tokens = Array.from(
  tokenize(fs.readFileSync(path.join("examples", "simple.xml"), "utf8"))
);

if (DEBUG) {
  console.log(tokens);
}

const parsed = parse(tokens);
if (DEBUG) {
  console.log(JSON.stringify(parsed, null, 2));
}

const formatted = format(parsed);
console.log(formatted);
