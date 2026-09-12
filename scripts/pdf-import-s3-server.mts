// Local-only S3 substitute for production browser gates. Never a runtime dependency.
import http from "node:http";
const objects = new Map<string, { bytes: Buffer; type: string }>();
const counts = { put: 0, get: 0, delete: 0 };
let failPuts = false,
  delayPutsMs = 0;
const xml = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/_gate") {
      if (req.method === "POST") {
        if (url.searchParams.has("failPuts"))
          failPuts = url.searchParams.get("failPuts") === "1";
        if (url.searchParams.has("delayPutsMs"))
          delayPutsMs = Math.min(
            10000,
            Math.max(0, Number(url.searchParams.get("delayPutsMs")) || 0),
          );
      }
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          counts,
          keys: [...objects.keys()],
          failPuts,
          delayPutsMs,
        }),
      );
      return;
    }
    const key = decodeURIComponent(url.pathname).replace(
      /^\/(?:octavo223\/)?/u,
      "",
    );
    if (url.searchParams.get("list-type") === "2") {
      const prefix = url.searchParams.get("prefix") ?? "";
      res.setHeader("Content-Type", "application/xml");
      res.end(
        `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><IsTruncated>false</IsTruncated>${[
          ...objects.keys(),
        ]
          .filter((k) => k.startsWith(prefix))
          .map((k) => `<Contents><Key>${xml(k)}</Key></Contents>`)
          .join("")}</ListBucketResult>`,
      );
      return;
    }
    if (req.method === "PUT") {
      counts.put++;
      if (delayPutsMs)
        await new Promise((resolve) => setTimeout(resolve, delayPutsMs));
      if (failPuts) {
        res.statusCode = 503;
        res.end("<Error><Code>ServiceUnavailable</Code></Error>");
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        if (bytes > 64 * 1024 * 1024) {
          res.statusCode = 413;
          res.end();
          return;
        }
        chunks.push(buffer);
      }
      objects.set(key, {
        bytes: Buffer.concat(chunks),
        type: req.headers["content-type"] ?? "application/octet-stream",
      });
      res.setHeader("ETag", '"octavo223"');
      res.end();
      return;
    }
    if (req.method === "DELETE") {
      counts.delete++;
      objects.delete(key);
      res.statusCode = 204;
      res.end();
      return;
    }
    counts.get++;
    const object = objects.get(key);
    if (!object) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/xml");
      res.end("<Error><Code>NoSuchKey</Code></Error>");
      return;
    }
    res.setHeader("Content-Type", object.type);
    res.setHeader("Content-Length", object.bytes.length);
    res.end(object.bytes);
  })
  .listen(19923, "127.0.0.1", () =>
    console.log("Local PDF import S3 harness: http://127.0.0.1:19923"),
  );
