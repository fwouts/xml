import { CommentToken, TextToken } from "./lexer";

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
