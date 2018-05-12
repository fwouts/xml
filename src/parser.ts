import {
  Token,
  LEFT_BRACKET,
  QUESTION_MARK,
  RIGHT_BRACKET,
  TextToken,
  TEXT,
  CommentToken,
  COMMENT,
  IDENTIFIER,
  SLASH,
  StringLiteralToken,
  IdentifierToken,
  EQUAL,
  STRING_LITERAL,
  EqualToken,
  LeftBracketToken,
  QuestionMarkToken,
  RightBracketToken,
  SlashToken,
  SPACE,
  TAB,
  LINEBREAK
} from "./tokenizer";

export interface Root {
  prologAttributes?: Attributes;
  rootElement: Element;
}

export interface Attributes {
  [key: string]: string;
}

export type Node = Element | TextToken | CommentToken;

export interface Element {
  tag: string;

  attributes: Attributes;

  // null = <Element />
  // empty list = <Element></Element>
  children: Node[] | null;
}

export function parse(tokens: Token[]): Root {
  const parsedRoot = PARSER.root(tokens);
  if (!parsedRoot) {
    // TODO: Debug better.
    throw new Error(`No root found.`);
  }
  let [root, consumedTokens] = parsedRoot;
  if (consumedTokens !== tokens.length) {
    // TODO: Debug better.
    throw new Error(
      `Found extraneous tokens: ${tokens
        .slice(consumedTokens)
        .map(t => t.kind)}.`
    );
  }
  return root;
}

export type Rule =
  | RootRule
  | PrologRule
  | NodeRule
  | ElementRule
  | StartTagRule
  | AttributeRule
  | EndTagRule
  | SelfClosingTagRule;

export const ROOT_RULE = "root";
export type RootRule = ParserRule<Root>;

export const PROLOG_RULE = "prolog";
export type PrologRule = ParserRule<Attributes>;

export const NODE_RULE = "node";
export type NodeRule = ParserRule<Node>;

export const ELEMENT_RULE = "element";
export type ElementRule = ParserRule<Element>;

export const START_TAG_RULE = "start-tag";
export type StartTagRule = ParserRule<StartTag>;
export interface StartTag {
  tag: string;
  attributes: Attributes;
}

export const ATTRIBUTE_RULE = "attribute";
export type AttributeRule = ParserRule<Attribute>;
export interface Attribute {
  key: string;
  value: string;
}

export const END_TAG_RULE = "end-tag";
export type EndTagRule = ParserRule<string>;

export const SELF_CLOSING_TAG_RULE = "self-closing-tag";
export type SelfClosingTagRule = ParserRule<SelfClosingTag>;
export type SelfClosingTag = StartTag;

export interface ParserRule<RuleResult> {
  (tokens: Token[]): ParserReturn<RuleResult>;
}
export type ParserReturn<RuleResult> = [RuleResult, number] | false;

// Ignored tokens:
// - SPACE
// - TAB
// - LINEBREAK
const IGNORED_SPACE_TOKENS = new Set([SPACE, TAB, LINEBREAK]);

// Also ignore TEXT tokens at the root (they're meant to just be whitespaces).
// TODO: Clean this up so we don't accept anything but whitespaces.
const IGNORED_ROOT_TOKENS = new Set([SPACE, TAB, LINEBREAK, TEXT]);

const PARSER: {
  [ROOT_RULE]: RootRule;
  [PROLOG_RULE]: PrologRule;
  [NODE_RULE]: NodeRule;
  [ELEMENT_RULE]: ElementRule;
  [START_TAG_RULE]: StartTagRule;
  [ATTRIBUTE_RULE]: AttributeRule;
  [END_TAG_RULE]: EndTagRule;
  [SELF_CLOSING_TAG_RULE]: SelfClosingTagRule;
} = {
  // root:
  // | prolog? element
  [ROOT_RULE]: tokens => {
    return unwind(
      find<[Attributes[], [Element]]>(
        PARSER,
        tokens,
        [optional(PROLOG_RULE), one(ELEMENT_RULE), optional(TEXT)],
        IGNORED_ROOT_TOKENS
      ),
      ([[prologAttributes], [rootElement]]) => {
        return {
          prologAttributes,
          rootElement
        };
      }
    );
  },
  // prolog:
  // | < ? IDENTIFIER attribute* ? >
  [PROLOG_RULE]: tokens => {
    return unwind(
      find<
        [
          [LeftBracketToken],
          [QuestionMarkToken],
          [IdentifierToken],
          Attribute[],
          [QuestionMarkToken],
          [RightBracketToken]
        ]
      >(
        PARSER,
        tokens,
        [
          one(LEFT_BRACKET),
          one(QUESTION_MARK),
          one(IDENTIFIER),
          atLeast(0, ATTRIBUTE_RULE),
          one(QUESTION_MARK),
          one(RIGHT_BRACKET)
        ],
        IGNORED_SPACE_TOKENS
      ),
      ([, , [identifier], attributeList, ,]) => {
        if (identifier.name !== "xml") {
          throw new Error(
            `Incorrect tag in prolog: ${identifier.name} (expected xml).`
          );
        }
        const attributes: Attributes = {};
        for (const attribute of attributeList) {
          attributes[attribute.key] = attribute.value;
        }
        return attributes;
      }
    );
  },
  // node:
  // | element
  // | TEXT
  // | COMMENT
  [NODE_RULE]: tokens => {
    const foundElement = find<[[Element]]>(
      PARSER,
      tokens,
      [one(ELEMENT_RULE)],
      IGNORED_SPACE_TOKENS
    );
    const foundText = find<[[TextToken]]>(
      PARSER,
      tokens,
      [one(TEXT)],
      IGNORED_SPACE_TOKENS
    );
    const foundComment = find<[[CommentToken]]>(
      PARSER,
      tokens,
      [one(COMMENT)],
      IGNORED_SPACE_TOKENS
    );
    if (foundElement) {
      return unwind(foundElement, ([[element]]) => {
        return element;
      });
    } else if (foundText) {
      return unwind(foundText, ([[text]]) => {
        return text;
      });
    } else if (foundComment) {
      return unwind(foundComment, ([[comment]]) => {
        return comment;
      });
    } else {
      return false;
    }
  },
  // element:
  // | startTag node* endTag
  // | selfClosingTag
  [ELEMENT_RULE]: tokens => {
    const foundOrdinaryTag = find<[[StartTag], Node[], [string]]>(
      PARSER,
      tokens,
      [one(START_TAG_RULE), atLeast(0, NODE_RULE), one(END_TAG_RULE)],
      IGNORED_SPACE_TOKENS
    );
    const foundSelfClosingTag = find<[[SelfClosingTag]]>(
      PARSER,
      tokens,
      [one(SELF_CLOSING_TAG_RULE)],
      IGNORED_SPACE_TOKENS
    );
    if (foundOrdinaryTag) {
      return unwind(foundOrdinaryTag, ([[startTag], nodes, [endTag]]) => {
        if (startTag.tag !== endTag) {
          throw new Error(
            `Found mismatching start tag ${startTag.tag} and end tag ${endTag}.`
          );
        }
        return {
          tag: startTag.tag,
          attributes: startTag.attributes,
          children: nodes
        };
      });
    } else if (foundSelfClosingTag) {
      return unwind(foundSelfClosingTag, ([[selfClosingTag]]) => {
        return {
          tag: selfClosingTag.tag,
          attributes: selfClosingTag.attributes,
          children: null
        };
      });
    } else {
      return false;
    }
  },
  // startTag:
  // | < IDENTIFIER attribute* >
  [START_TAG_RULE]: tokens => {
    return unwind(
      find<[any, [IdentifierToken], Attribute[]]>(
        PARSER,
        tokens,
        [
          one(LEFT_BRACKET),
          one(IDENTIFIER),
          atLeast(0, ATTRIBUTE_RULE),
          one(RIGHT_BRACKET)
        ],
        IGNORED_SPACE_TOKENS
      ),
      ([, [identifier], attributeList]) => {
        const attributes: Attributes = {};
        for (const attribute of attributeList) {
          attributes[attribute.key] = attribute.value;
        }
        return {
          tag: identifier.name,
          attributes
        };
      }
    );
  },
  // attribute:
  // | IDENTIFIER = STRING_LITERAL
  [ATTRIBUTE_RULE]: tokens => {
    return unwind(
      find<[[IdentifierToken], [EqualToken], [StringLiteralToken]]>(
        PARSER,
        tokens,
        [one(IDENTIFIER), one(EQUAL), one(STRING_LITERAL)],
        IGNORED_SPACE_TOKENS
      ),
      ([[identifier], , [stringLiteral]]) => {
        return {
          key: identifier.name,
          value: stringLiteral.quotedValue
        };
      }
    );
  },
  // endTag:
  // | < / IDENTIFIER >
  [END_TAG_RULE]: tokens => {
    return unwind(
      find<[[LeftBracketToken], [SlashToken], [IdentifierToken]]>(
        PARSER,
        tokens,
        [one(LEFT_BRACKET), one(SLASH), one(IDENTIFIER), one(RIGHT_BRACKET)],
        IGNORED_SPACE_TOKENS
      ),
      ([, , [identifier]]) => {
        return identifier.name;
      }
    );
  },
  // selfClosingTag:
  // | < IDENTIFIER attribute* / >
  [SELF_CLOSING_TAG_RULE]: tokens => {
    return unwind(
      find<[[LeftBracketToken], [IdentifierToken], Attribute[]]>(
        PARSER,
        tokens,
        [
          one(LEFT_BRACKET),
          one(IDENTIFIER),
          atLeast(0, ATTRIBUTE_RULE),
          one(SLASH),
          one(RIGHT_BRACKET)
        ],
        IGNORED_SPACE_TOKENS
      ),
      ([, [identifier], attributeList]) => {
        const attributes: Attributes = {};
        for (const attribute of attributeList) {
          attributes[attribute.key] = attribute.value;
        }
        return {
          tag: identifier.name,
          attributes
        };
      }
    );
  }
};

function unwind<T, R>(
  found: FindResult<T>,
  f: (output: T) => R
): ParserReturn<R> {
  if (found === false) {
    return false;
  }
  const [output, consumedTokens] = found;
  return [f(output), consumedTokens];
}

// find() returns either:
// - a tuple with:
//   1. an array containing one array for each expected item (with zero or more results in each)
//   2. a number representing the number of tokens consumed
// - or false
type FindResult<T> = [T, number] | false;

function find<T extends Array<Array<any>>>(
  parser: { [tokenOrRuleName: string]: ParserRule<any> },
  tokens: Token[],
  sequence: ExpectedItem[],
  ignoreTokens: Set<number>
): FindResult<T> {
  if (sequence.length === 0) {
    return [([] as any) as T, 0];
  }
  const expectedItem = sequence[0];
  if (expectedItem.maximum !== undefined && expectedItem.maximum <= 0) {
    // Bail early (recursive case).
    return false;
  }

  // We'll add the result we found at the beginning of the list.
  const results: T = ([] as any) as T;
  let foundMatch = false;
  let consumedTokens = 0;

  // Skip any ignored tokens.
  while (
    tokens.length > consumedTokens &&
    ignoreTokens.has(tokens[consumedTokens].kind)
  ) {
    consumedTokens++;
  }
  tokens = tokens.slice(consumedTokens);

  if (typeof expectedItem.tokenOrRuleName === "string") {
    // We're invoking another parser rule.
    if (!parser[expectedItem.tokenOrRuleName]) {
      throw new Error(`No rule defined for ${expectedItem.tokenOrRuleName}.`);
    }
    const ruleParserResult = parser[expectedItem.tokenOrRuleName](tokens);

    if (ruleParserResult) {
      foundMatch = true;
      const [result, usedTokens] = ruleParserResult;
      results.push([result]);
      tokens = tokens.slice(usedTokens);
      consumedTokens += usedTokens;
    } else {
      foundMatch = false;
      results.push([]);
    }
  } else {
    // We're checking for a specific token kind.
    const tokenResult =
      tokens[0] && tokens[0].kind === expectedItem.tokenOrRuleName
        ? tokens[0]
        : false;
    if (tokenResult) {
      foundMatch = true;
      results.push([tokenResult]);
      tokens = tokens.slice(1);
      consumedTokens = 1;
    } else {
      foundMatch = false;
      results.push([]);
      consumedTokens = 0;
    }
  }

  if (!foundMatch && expectedItem.minimum > 0) {
    // We expected this rule to find something. Bail early.
    return false;
  }

  // Then keep looking for further results.
  // Either we keep finding the same rule (ensuring to decreasing minimum and maximum
  // to take account what we've found already).
  // Note that we don't do this if we haven't found something already, since that would
  // result in an infinite loop.
  const foundNextSelf = !foundMatch
    ? false
    : find<T>(
        parser,
        tokens,
        [
          {
            minimum: Math.max(0, expectedItem.minimum - 1),
            maximum:
              expectedItem.maximum !== undefined
                ? expectedItem.maximum - 1
                : undefined,
            tokenOrRuleName: expectedItem.tokenOrRuleName
          },
          ...sequence.slice(1)
        ],
        ignoreTokens
      );
  // Or we start going through the rest of the sequence, only if we've satisfied the
  // minimum number of instances found.
  const foundNextRest =
    expectedItem.minimum > 1
      ? false
      : find<T>(parser, tokens, sequence.slice(1), ignoreTokens);

  if (foundNextSelf || foundNextRest) {
    let nextResults;
    let nextConsumedTokens;
    if (
      (foundNextSelf && !foundNextRest) ||
      (foundNextSelf && foundNextRest && foundNextSelf[1] > foundNextRest[1])
    ) {
      [nextResults, nextConsumedTokens] = foundNextSelf;
      // Merge results from the same rule into the first place.
      results[0].push(...nextResults[0]);
      results.push(...nextResults.slice(1));
    } else if (foundNextRest) {
      [nextResults, nextConsumedTokens] = foundNextRest;
      results.push(...nextResults);
    } else {
      // This cannot happen.
      throw new Error();
    }
    // Skip any ignored tokens at the end.
    let endIgnoredTokens = 0;
    while (
      tokens.length > nextConsumedTokens + endIgnoredTokens &&
      ignoreTokens.has(tokens[nextConsumedTokens + endIgnoredTokens].kind)
    ) {
      endIgnoredTokens++;
    }
    consumedTokens += nextConsumedTokens + endIgnoredTokens;
    return [results, consumedTokens];
  } else {
    return false;
  }
}

function optional(tokenOrRuleName: string | number): ExpectedItem {
  return {
    minimum: 0,
    maximum: 1,
    tokenOrRuleName
  };
}

function one(tokenOrRuleName: string | number): ExpectedItem {
  return {
    minimum: 1,
    maximum: 1,
    tokenOrRuleName
  };
}

function atLeast(
  minimum: number,
  tokenOrRuleName: string | number
): ExpectedItem {
  return {
    minimum,
    tokenOrRuleName
  };
}

export interface ExpectedItem {
  minimum: number;
  maximum?: number;
  tokenOrRuleName: string | number;
}
