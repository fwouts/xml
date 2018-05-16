import * as fs from "fs";
import * as path from "path";
import { format } from "./xml/formatter";
import { tokenize } from "./xml/lexer";
import { parse } from "./xml/parser";

const tokens = Array.from(
  tokenize(
    fs.readFileSync(
      path.join(__dirname, "..", "examples", "simple.xml"),
      "utf8"
    )
  )
);
console.log(tokens);

const parsed = parse(tokens);
console.log(JSON.stringify(parsed, null, 2));

const formatted = format(parsed);
console.log(formatted);
