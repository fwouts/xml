import { ParserRule, atLeast, find, one, optional, unwind } from "../parsing";
import {
  COMMENT,
  CommentToken,
  EQUAL,
  EqualToken,
  IDENTIFIER,
  IdentifierToken,
  LEFT_BRACKET,
  LINEBREAK,
  LeftBracketToken,
  QUESTION_MARK,
  QuestionMarkToken,
  RIGHT_BRACKET,
  RightBracketToken,
  SLASH,
  SPACE,
  STRING_LITERAL,
  SlashToken,
  StringLiteralToken,
  TAB,
  TEXT,
  TextToken,
  XmlToken
} from "./lexer";

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

export function parse(tokens: XmlToken[]): Root {
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
export type RootRule = ParserRule<XmlToken, Root>;

export const PROLOG_RULE = "prolog";
export type PrologRule = ParserRule<XmlToken, Attributes>;

export const NODE_RULE = "node";
export type NodeRule = ParserRule<XmlToken, Node>;

export const ELEMENT_RULE = "element";
export type ElementRule = ParserRule<XmlToken, Element>;

export const START_TAG_RULE = "start-tag";
export type StartTagRule = ParserRule<XmlToken, StartTag>;
export interface StartTag {
  tag: string;
  attributes: Attributes;
}

export const ATTRIBUTE_RULE = "attribute";
export type AttributeRule = ParserRule<XmlToken, Attribute>;
export interface Attribute {
  key: string;
  value: string;
}

export const END_TAG_RULE = "end-tag";
export type EndTagRule = ParserRule<XmlToken, string>;

export const SELF_CLOSING_TAG_RULE = "self-closing-tag";
export type SelfClosingTagRule = ParserRule<XmlToken, SelfClosingTag>;
export type SelfClosingTag = StartTag;

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
      find<XmlToken, [Attributes[], [Element]]>(
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
        XmlToken,
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
    const foundElement = find<XmlToken, [[Element]]>(
      PARSER,
      tokens,
      [one(ELEMENT_RULE)],
      IGNORED_SPACE_TOKENS
    );
    const foundText = find<XmlToken, [[TextToken]]>(
      PARSER,
      tokens,
      [one(TEXT)],
      IGNORED_SPACE_TOKENS
    );
    const foundComment = find<XmlToken, [[CommentToken]]>(
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
    const foundOrdinaryTag = find<XmlToken, [[StartTag], Node[], [string]]>(
      PARSER,
      tokens,
      [one(START_TAG_RULE), atLeast(0, NODE_RULE), one(END_TAG_RULE)],
      IGNORED_SPACE_TOKENS
    );
    const foundSelfClosingTag = find<XmlToken, [[SelfClosingTag]]>(
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
      find<XmlToken, [any, [IdentifierToken], Attribute[]]>(
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
      find<XmlToken, [[IdentifierToken], [EqualToken], [StringLiteralToken]]>(
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
      find<XmlToken, [[LeftBracketToken], [SlashToken], [IdentifierToken]]>(
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
      find<XmlToken, [[LeftBracketToken], [IdentifierToken], Attribute[]]>(
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
