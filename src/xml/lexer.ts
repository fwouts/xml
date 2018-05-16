export type XmlToken =
  | LeftBracketToken
  | RightBracketToken
  | SlashToken
  | EqualToken
  | QuestionMarkToken
  | SpaceToken
  | TabToken
  | LinebreakToken
  | IdentifierToken
  | StringLiteralToken
  | TextToken
  | CommentToken;

export const LEFT_BRACKET = 1;
export const LEFT_BRACKET_TOKEN: LeftBracketToken = { kind: LEFT_BRACKET };
export interface LeftBracketToken {
  kind: typeof LEFT_BRACKET;
}

export const RIGHT_BRACKET = 2;
export const RIGHT_BRACKET_TOKEN: RightBracketToken = { kind: RIGHT_BRACKET };
export interface RightBracketToken {
  kind: typeof RIGHT_BRACKET;
}

export const SLASH = 3;
export const SLASH_TOKEN: SlashToken = { kind: SLASH };
export interface SlashToken {
  kind: typeof SLASH;
}

export const EQUAL = 4;
export const EQUAL_TOKEN: EqualToken = { kind: EQUAL };
export interface EqualToken {
  kind: typeof EQUAL;
}

export const QUESTION_MARK = 5;
export const QUESTION_MARK_TOKEN: QuestionMarkToken = { kind: QUESTION_MARK };
export interface QuestionMarkToken {
  kind: typeof QUESTION_MARK;
}

export const SPACE = 6;
export const SPACE_TOKEN: SpaceToken = { kind: SPACE };
export interface SpaceToken {
  kind: typeof SPACE;
}

export const TAB = 7;
export const TAB_TOKEN: TabToken = { kind: TAB };
export interface TabToken {
  kind: typeof TAB;
}

export const LINEBREAK = 8;
export const LINEBREAK_TOKEN: LinebreakToken = { kind: LINEBREAK };
export interface LinebreakToken {
  kind: typeof LINEBREAK;
}

export const IDENTIFIER = 9;
export const IDENTIFIER_TOKEN = { kind: IDENTIFIER };
export interface IdentifierToken {
  kind: typeof IDENTIFIER;
  name: string;
}

export const STRING_LITERAL = 10;
export const STRING_LITERAL_TOKEN = { kind: STRING_LITERAL };
export interface StringLiteralToken {
  kind: typeof STRING_LITERAL;
  quotedValue: string;
}

export const TEXT = 11;
export const TEXT_TOKEN = { kind: TEXT };
export interface TextToken {
  kind: typeof TEXT;
  text: string;
}

export const COMMENT = 12;
export const COMMENT_TOKEN = { kind: COMMENT };
export interface CommentToken {
  kind: typeof COMMENT;
  content: string;
}

export type Mode = typeof CONTENT | typeof WITHIN_TAG;

const CONTENT = 1;
const WITHIN_TAG = 2;

export function* tokenize(text: string): IterableIterator<XmlToken> {
  let position = 0;
  let mode: Mode = CONTENT;
  while (position < text.length) {
    let nextToken: XmlToken;
    const oldPosition = position;
    [nextToken, position, mode] = readToken(text, position, mode);
    if (position <= oldPosition) {
      throw new Error(`Infinite loop at token ${JSON.stringify(nextToken)}.`);
    }
    yield nextToken;
  }
}

function readToken(
  text: string,
  fromPosition: number,
  mode: Mode
): [XmlToken, number, Mode] {
  const firstCharacter = text[fromPosition];
  let nextTokenPosition = fromPosition + 1;
  if (mode === CONTENT) {
    if (firstCharacter === "<") {
      if (text.substr(nextTokenPosition, 3) === "!--") {
        // This is a comment.
        const commentEndPosition = text.indexOf("-->", nextTokenPosition);
        if (commentEndPosition === -1) {
          throw new Error(
            `Detected unfinished comment: ${text.substring(fromPosition)}.`
          );
        } else {
          const content = text.substring(fromPosition + 4, commentEndPosition);
          nextTokenPosition = commentEndPosition + 3;
          return [
            {
              kind: COMMENT,
              content
            },
            nextTokenPosition,
            CONTENT
          ];
        }
      } else {
        return [LEFT_BRACKET_TOKEN, nextTokenPosition, WITHIN_TAG];
      }
    } else {
      const nextTagPosition = text.indexOf("<", nextTokenPosition);
      let tokenText;
      if (nextTagPosition === -1) {
        tokenText = text.substr(fromPosition);
        nextTokenPosition = text.length;
      } else {
        tokenText = text.substring(fromPosition, nextTagPosition);
        nextTokenPosition = nextTagPosition;
      }
      return [
        {
          kind: TEXT,
          text: tokenText
        },
        nextTokenPosition,
        CONTENT
      ];
    }
  } else {
    // WITHIN_TAG
    switch (firstCharacter) {
      case ">":
        return [RIGHT_BRACKET_TOKEN, nextTokenPosition, CONTENT];
      case "/":
        return [SLASH_TOKEN, nextTokenPosition, WITHIN_TAG];
      case "?":
        return [QUESTION_MARK_TOKEN, nextTokenPosition, WITHIN_TAG];
      case "=":
        return [EQUAL_TOKEN, nextTokenPosition, WITHIN_TAG];
      case " ":
        return [SPACE_TOKEN, nextTokenPosition, WITHIN_TAG];
      case "\t":
        return [TAB_TOKEN, nextTokenPosition, WITHIN_TAG];
      case "\r":
        if (text[nextTokenPosition] === "\n") {
          nextTokenPosition++;
        }
        return [LINEBREAK_TOKEN, nextTokenPosition, WITHIN_TAG];
      case "\n":
        return [LINEBREAK_TOKEN, nextTokenPosition, WITHIN_TAG];
      case '"':
        while (text[nextTokenPosition] !== '"') {
          if (text[nextTokenPosition] === "\\") {
            // Next character is escaped.
            nextTokenPosition++;
          }
          nextTokenPosition++;
          if (nextTokenPosition >= text.length) {
            throw new Error(
              `Detected unfinished string: ${text.substring(fromPosition)}.`
            );
          }
        }
        nextTokenPosition++;
        return [
          {
            kind: STRING_LITERAL,
            quotedValue: text.substring(fromPosition, nextTokenPosition)
          },
          nextTokenPosition,
          WITHIN_TAG
        ];
      default:
        if (isValidIdentifierCharacter(firstCharacter, true)) {
          while (isValidIdentifierCharacter(text[nextTokenPosition], false)) {
            nextTokenPosition++;
            if (nextTokenPosition >= text.length) {
              throw new Error(
                `Detected unfinished identifier: ${text.substring(
                  fromPosition
                )}.`
              );
            }
          }
          return [
            {
              kind: IDENTIFIER,
              name: text.substring(fromPosition, nextTokenPosition)
            },
            nextTokenPosition,
            WITHIN_TAG
          ];
        } else {
          throw new Error(`Unexpected character: ${firstCharacter}`);
        }
    }
  }
}

function isValidIdentifierCharacter(
  character: string,
  isFirst: boolean
): boolean {
  if (
    (character >= "a" && character <= "z") ||
    (character >= "A" && character <= "Z")
  ) {
    return true;
  }
  if (isFirst) {
    return false;
  }
  switch (character) {
    case ":":
    case "-":
    case "_":
      return true;
    default:
      if (character >= "0" && character <= "9") {
        return true;
      }
      return false;
  }
}
