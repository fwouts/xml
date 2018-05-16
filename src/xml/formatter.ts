import assertNever from "assert-never";
import TextBuilder from "textbuilder";
import { COMMENT, TEXT } from "./lexer";
import * as xml from "./model";

export function format(root: xml.Root) {
  const t = new TextBuilder();
  formatRoot(t, root);
  return t.build();
}

function formatRoot(t: TextBuilder, root: xml.Root) {
  if (root.prologAttributes) {
    formatProlog(t, root.prologAttributes);
  }
  formatElement(t, root.rootElement);
}

function formatProlog(t: TextBuilder, prolog: xml.Attributes) {
  t.append("<?xml");
  formatAttributes(t, prolog);
  t.append("?>\n");
}

function formatNodes(t: TextBuilder, nodes: xml.Node[]) {
  if (nodes.length > 0) {
    t.indented(() => {
      let first = true;
      for (const child of nodes) {
        if (formatNode(t, child, first)) {
          first = false;
        }
      }
    });
  }
}

function formatNode(t: TextBuilder, node: xml.Node, isFirst: boolean): boolean {
  if ("kind" in node) {
    switch (node.kind) {
      case TEXT:
        const content = node.text.trim();
        if (!content) {
          // Skip empty text nodes.
          return false;
        }
        if (!isFirst) {
          t.linebreak();
        }
        t.append(node.text.trim());
        break;
      case COMMENT:
        if (!isFirst) {
          t.linebreak();
        }
        t.append("<!--", node.content, "-->");
        break;
      default:
        assertNever(node);
    }
  } else {
    formatElement(t, node);
  }
  return true;
}

function formatElement(t: TextBuilder, element: xml.Element) {
  if (element.children === null) {
    t.append("<", element.tag);
    formatAttributes(t, element.attributes);
    t.append("/>");
  } else {
    t.append("<", element.tag);
    formatAttributes(t, element.attributes);
    t.append(">");
    formatNodes(t, element.children);
    t.append("</", element.tag, ">");
  }
  t.linebreak();
}

function formatAttributes(t: TextBuilder, attributes: xml.Attributes) {
  if (Object.keys(attributes).length > 0) {
    t.indented(() => {
      let first = true;
      for (const [key, value] of Object.entries(attributes)) {
        if (!first) {
          t.linebreak();
        }
        t.append(key, "=", value);
        first = false;
      }
    });
  }
}
