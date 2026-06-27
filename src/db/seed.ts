// Seed the local database with a sample issue so the reader has content.
// Run: npm run db:seed  (after `docker compose up -d` and `npm run db:migrate`)
import type { IssueContent } from "../lib/blocks";

// Load .env.local before importing modules that read process.env.
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // env may already be set in the shell — fine.
}

const id = () => crypto.randomUUID();

const longGame: IssueContent = {
  pages: [
    {
      id: id(),
      blocks: [
        { id: id(), type: "heading", kicker: "Editorial", title: "A Note on Winter" },
        { id: id(), type: "text", text: "There is a particular pleasure to a winter morning on the piste: the gravel firm underfoot, breath hanging in the air, and the slow ceremony of measuring a point that no one will concede." },
        { id: id(), type: "image", caption: "Frost on the terrain, early." },
      ],
    },
    {
      id: id(),
      blocks: [
        { id: id(), type: "heading", kicker: "Report", title: "The Winter Doubles" },
        { id: id(), type: "text", text: "By the second end it was clear the terrain would do most of the talking. The rain of the week before had left the far rink slow and honest; the near rink ran fast and full of opinions." },
        { id: id(), type: "text", text: "In the end a single boule, eleven millimetres closer than its rival, decided the title. The measure took four minutes. Nobody breathed." },
        { id: id(), type: "sponsor", name: "Example Sponsor Co.", href: "https://example.com" },
      ],
    },
    {
      id: id(),
      blocks: [
        { id: id(), type: "heading", kicker: "Technique", title: "Reading the Ground" },
        { id: id(), type: "text", text: "New players think the game is in the hand. It is not — it is in the eye, and the eye is trained on the ground, not the target." },
        { id: id(), type: "image", caption: "The donnée and the roll." },
      ],
    },
  ],
};

async function main() {
  const { db } = await import("./index");
  const { issues } = await import("./schema");

  await db.delete(issues);
  await db.insert(issues).values([
    {
      number: 14,
      title: "The Long Game",
      theme: "classic",
      status: "published",
      content: longGame,
      publishedAt: new Date(),
    },
    {
      number: 15,
      title: "Untitled draft",
      theme: "classic",
      status: "draft",
      content: { pages: [{ id: id(), blocks: [] }] },
    },
  ]);

  console.log("Seeded 1 published issue (No. 14) and 1 draft (No. 15).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
