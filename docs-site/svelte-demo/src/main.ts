import { mount, unmount } from "svelte";
import Demo from "./Demo.svelte";

/** Mount the Svelte demo into `target`; returns a cleanup for React's effect. */
export function mountDemo(target: HTMLElement) {
  const app = mount(Demo, { target });
  return () => unmount(app);
}
