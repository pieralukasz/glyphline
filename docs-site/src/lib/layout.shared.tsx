import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, repoUrl } from "./shared";

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="2"
        y="6"
        width="20"
        height="12"
        rx="4"
        fill="var(--gl-logo-a, #f6d860)"
      />
      <rect
        x="9"
        y="8"
        width="9"
        height="8"
        rx="2.5"
        fill="var(--gl-logo-b, #e2a514)"
      />
    </svg>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2 font-semibold">
          <Logo />
          {appName}
        </span>
      ),
    },
    githubUrl: repoUrl,
    links: [
      { text: "Docs", url: "/docs" },
      { text: "React", url: "/docs/react" },
      { text: "Svelte", url: "/docs/svelte" },
    ],
  };
}
