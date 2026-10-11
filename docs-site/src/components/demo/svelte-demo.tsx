"use client";
import { useEffect, useRef, useState } from "react";
import { asset } from "@/lib/shared";

/**
 * Mounts the Svelte demo (svelte-demo/, built by Vite into public/svelte-demo/demo.js). The page is
 * React, the demo inside it is a real Svelte 5 app using svelte-glyphline.
 */
export function SvelteDemo() {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let off = false;
    const url = asset("/svelte-demo/demo.js");
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)
      .then((m: { mountDemo: (el: HTMLElement) => () => void }) => {
        if (!off && host.current) cleanup = m.mountDemo(host.current);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      off = true;
      cleanup?.();
    };
  }, []);
  return (
    <div ref={host} data-svelte-host="">
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
