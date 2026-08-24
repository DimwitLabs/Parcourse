import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docs: [
    "intro",
    "first-run",
    {
      type: "category",
      label: "Using Parcourse",
      collapsed: false,
      items: ["using/courses", "using/quizzes", "using/cheatsheets", "using/knowledge-graph"],
    },
    {
      type: "category",
      label: "Self-Hosting",
      collapsed: false,
      items: [
        "self-hosting/install",
        "self-hosting/providers",
        "self-hosting/users",
        "self-hosting/upgrading",
        "self-hosting/troubleshooting",
      ],
    },
    {
      type: "category",
      label: "Reference",
      collapsed: false,
      items: [
        "reference/configuration",
        {
          type: "link",
          label: "Changelog",
          href: "https://github.com/DimwitLabs/Parcourse/blob/main/CHANGELOG.md",
        },
      ],
    },
  ],
};

export default sidebars;
