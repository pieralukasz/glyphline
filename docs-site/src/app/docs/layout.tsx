import { GlassLayout } from "fumadocs-ui/layouts/glass";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <GlassLayout tree={source.getPageTree()} {...baseOptions()}>
      {children}
    </GlassLayout>
  );
}
