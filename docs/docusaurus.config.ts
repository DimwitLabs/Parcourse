import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import type { PrismTheme } from "prism-react-renderer";

import sectionCards from "./src/remark/sectionCards";

const REPO = "https://github.com/DimwitLabs/Parcourse";

const codeTheme: PrismTheme = {
  plain: {
    color: "var(--color-secondary)",
    backgroundColor: "var(--color-primary-wash)",
  },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "var(--color-ink-faint)", fontStyle: "italic" } },
    { types: ["punctuation", "operator"], style: { color: "var(--color-ink-soft)" } },
    { types: ["keyword", "builtin", "selector", "attr-name"], style: { color: "var(--color-primary)", fontWeight: "700" } },
    { types: ["function", "class-name"], style: { color: "var(--color-primary-hover)", fontWeight: "700" } },
    { types: ["string", "char", "inserted", "url"], style: { color: "var(--color-sage)" } },
    { types: ["number", "boolean", "constant", "symbol"], style: { color: "var(--color-primary-light)" } },
    { types: ["variable", "parameter", "property"], style: { color: "var(--color-secondary)" } },
    { types: ["deleted"], style: { color: "var(--color-danger)" } },
  ],
};

function appVersion() {
  try {
    const here = fileURLToPath(new URL(".", import.meta.url));
    return JSON.parse(readFileSync(`${here}../frontend/package.json`, "utf8")).version as string;
  } catch {
    return "";
  }
}

const config: Config = {
  title: "Parcourse Docs",
  tagline: "Turn curiosity into knowledge",
  favicon: "img/parcourse.svg",

  url: "https://docs.parcourse.dimwit.me",
  baseUrl: "/",

  organizationName: "DimwitLabs",
  projectName: "Parcourse",

  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",

  markdown: {
    format: "mdx",
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  customFields: {
    appVersion: appVersion(),
    repo: REPO,
  },

  future: {
    v4: true,
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          remarkPlugins: [sectionCards],
          editUrl: `${REPO}/tree/main/docs/`,
        },
        blog: false,
        pages: false,
        theme: {
          customCss: ["./src/css/custom.css"],
        },
        sitemap: {
          lastmod: "date",
          changefreq: "weekly",
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      "@easyops-cn/docusaurus-search-local",
      {
        // The docs sit at the site root, and the indexer has to be told so or
        // it looks for them under /docs and finds nothing.
        docsRouteBasePath: "/",
        indexBlog: false,
        hashed: true,
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 8,
        searchResultContextMaxLength: 60,
      },
    ],
  ],

  themeConfig: {
    image: "img/parcourse-wordmark.svg",
    metadata: [
      { name: "description", content: "Documentation for Parcourse, self-hosted courses from any YouTube video." },
    ],
    colorMode: {
      defaultMode: "light",
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "",
      logo: {
        alt: "Parcourse",
        src: "img/parcourse-wordmark.svg",
        srcDark: "img/parcourse-wordmark-dark.svg",
        href: "/",
        height: 28,
      },
      items: [
        { to: "/", label: "Docs", position: "left", activeBaseRegex: "^/$" },
        { to: "/self-hosting/install", label: "Self-Hosting", position: "left" },
        { to: "/reference/configuration", label: "Reference", position: "left" },
        { type: "search", position: "right" },
        { type: "custom-versionPill", position: "right" },
      ],
    },
    footer: {
      style: "light",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Getting started", to: "/" },
            { label: "Self-Hosting", to: "/self-hosting/install" },
            { label: "Reference", to: "/reference/configuration" },
          ],
        },
        {
          title: "Project",
          items: [
            { label: "License", href: `${REPO}/blob/main/LICENSE` },
            { label: "Changelog", href: `${REPO}/blob/main/CHANGELOG.md` },
            { label: "Security", href: `${REPO}/blob/main/SECURITY.md` },
          ],
        },
        {
          title: "Elsewhere",
          items: [
            { label: "Parcourse", href: "https://parcourse.dimwit.me" },
            { label: "Dimwit Labs", href: "https://dimwit.me" },
          ],
        },
      ],
      copyright:
        'Made with love and labour, and backed by the <a href="https://dimwit.me/pledge" target="_blank" rel="noopener noreferrer">Dimwit Pledge</a>',
    },
    docs: {
      sidebar: { hideable: false, autoCollapseCategories: false },
    },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
    prism: {
      theme: codeTheme,
      darkTheme: codeTheme,
      additionalLanguages: ["bash"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
