import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

export default function VersionPill() {
  const { siteConfig } = useDocusaurusContext();
  const version = siteConfig.customFields?.appVersion as string;
  const repo = siteConfig.customFields?.repo as string;

  if (!version) return null;

  return (
    <a
      className="version-pill"
      href={`${repo}/releases/tag/v${version}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Parcourse ${version}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
      {version}
    </a>
  );
}
