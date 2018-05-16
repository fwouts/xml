import * as fs from "fs";
import * as path from "path";
import { parse } from "./xml/parser";
import { tokenize } from "./xml/tokenizer";

const tokens = Array.from(
  tokenize(
    fs.readFileSync(
      path.join(__dirname, "..", "examples", "simple.xml"),
      "utf8"
    )
  )
);
console.log(tokens);
console.log(JSON.stringify(parse(tokens), null, 2));
