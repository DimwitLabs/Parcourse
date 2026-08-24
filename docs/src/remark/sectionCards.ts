type Node = { type: string; depth?: number; name?: string; children?: Node[] };

function card(children: Node[]) {
  return {
    type: "mdxJsxFlowElement",
    name: "section",
    attributes: [{ type: "mdxJsxAttribute", name: "className", value: "doc-card" }],
    children,
  };
}

export default function sectionCards() {
  return (tree: { children: Node[] }) => {
    const grouped: Node[] = [];
    let open: Node[] | null = null;

    const close = () => {
      if (open?.length) grouped.push(card(open) as Node);
      open = null;
    };

    const invisible = new Set(["mdxjsEsm", "mdxFlowExpression", "yaml", "definition"]);

    for (const node of tree.children) {
      if (invisible.has(node.type)) {
        if (open) open.push(node);
        else grouped.push(node);
        continue;
      }
      if (node.type === "heading" && node.depth === 2) {
        close();
        open = [node];
        continue;
      }
      (open ??= []).push(node);
    }
    close();

    tree.children = grouped;
  };
}
