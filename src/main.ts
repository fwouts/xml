import * as fs from "fs";
import * as path from "path";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";

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
