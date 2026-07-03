import type { MetadataRoute } from "next";

// Block all crawling. Decision settled with the reader gate (issue #5):
// everything is members-only — even /signin has nothing worth indexing —
// so the noindex stays global (mirrored in the layout `robots` metadata).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
