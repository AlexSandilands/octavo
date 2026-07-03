import type { MetadataRoute } from "next";

// Block all crawling: members-only content with no auth gate yet.
// TODO(auth): once sign-in lands, decide which pages (landing, /signin)
// should become indexable and relax this + the layout `robots` metadata.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
