import * as fs from "fs";
import * as path from "path";
import { format } from "./xml/formatter";
import { tokenize } from "./xml/lexer";
import { parse } from "./xml/parser";

const DEBUG = false;

const tokens = Array.from(
  tokenize(
    fs.readFileSync(
      path.join(__dirname, "..", "examples", "simple.xml"),
      "utf8"
    )
  )
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
