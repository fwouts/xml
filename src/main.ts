import * as fs from "fs";
import * as path from "path";
import { tokenize } from "./tokenizer";

const tokens = tokenize(
  fs.readFileSync(path.join(__dirname, "..", "examples", "simple.xml"), "utf8")
);
console.log(Array.from(tokens));
