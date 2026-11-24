import { runRoutes } from "@repo/playtest/replays";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config";

const uiBuildPath = new URL("../../ui/build/", import.meta.url);
/** The scans of the original components, which the game shows beside the Legacy cards, doors and packages. */
const scansPath = fileURLToPath(new URL("../../../docs/assets/", import.meta.url));

const server = Bun.serve({
  development: config.environment === "development",
  idleTimeout: 120,
  port: config.port,
  routes: {
    "/api/status": Response.json({ ok: true, now: new Date().toISOString() }),
    ...runRoutes,
  },
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/scans/"))
      return scan(decodeURIComponent(url.pathname.slice("/api/scans/".length)));

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    return staticFile(url.pathname);
  },
});

async function scan(relative: string) {
  const path = resolve(scansPath, relative);
  const file = Bun.file(path);
  if (
    !path.startsWith(scansPath.endsWith(sep) ? scansPath : scansPath + sep) ||
    !(await file.exists())
  )
    return new Response("Not found", { status: 404 });
  return new Response(file, { headers: { "cache-control": "public, max-age=86400" } });
}

async function staticFile(pathname: string) {
  const path = pathname === "/" ? "/index.html" : pathname;
  const file = Bun.file(new URL(`.${path}`, uiBuildPath));

  if (await file.exists()) {
    return new Response(file);
  }

  const index = Bun.file(new URL("./index.html", uiBuildPath));
  if (await index.exists()) {
    return new Response(index);
  }

  return new Response("UI build not found. Run `bun run build` or use `bun run dev`.", {
    status: 404,
  });
}

console.log(`server listening on http://${server.hostname}:${server.port}`);
