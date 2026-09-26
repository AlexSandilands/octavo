// A fixture issue in the shapes the editor's code takes (#315): the
// measurers' options, and the AssistantIssue the projection and read_page
// read — built the way use-assistant-snapshot.ts builds it from the editor.
import type { Page } from "../../src/lib/blocks.ts";
import { EMPTY_SETTINGS, resolveSettings } from "../../src/lib/branding.ts";
import { siteDefaults } from "../../src/lib/site-defaults.ts";
import type { AssistantIssue } from "../../src/features/editor/assistant/issue-context.ts";
import type { FixtureIssue } from "../fixtures/assistant/cases.mts";
import type { HarnessOptions } from "./browser-entry.tsx";
import { IMAGE_PATH, type MeasureBrowser } from "./measure.mts";

export function settingsFor(issue: FixtureIssue) {
  return {
    ...resolveSettings(EMPTY_SETTINGS, siteDefaults),
    ...issue.settings,
  };
}

export function harnessOptions(issue: FixtureIssue): HarnessOptions {
  return {
    themeId: issue.theme,
    images: Object.fromEntries(
      [...issue.images].map(([id, img]) => [
        id,
        { url: `${IMAGE_PATH}${id}`, width: img.width, height: img.height },
      ]),
    ),
    sponsors: {},
    settings: settingsFor(issue),
    logo: null,
    issueNo: 1,
  };
}

/** Point the browser at the issue's images and page chrome. */
export async function configureFor(
  browser: MeasureBrowser,
  issue: FixtureIssue,
): Promise<void> {
  browser.files.clear();
  for (const [id, img] of issue.images) browser.files.set(id, img.file);
  await browser.configure(harnessOptions(issue));
}

/** What the model reads about `pages`, every page's fill measured. */
export async function assistantIssue(
  issue: FixtureIssue,
  pages: Page[],
  browser: MeasureBrowser,
): Promise<AssistantIssue> {
  return {
    title: issue.title,
    theme: issue.theme,
    pages,
    images: Object.fromEntries(
      [...issue.images].map(([id, img]) => [
        id,
        { width: img.width, height: img.height },
      ]),
    ),
    uploads: issue.uploads,
    logos: issue.logos.map((l) => ({ id: l.id, name: l.name })),
    sponsorNames: issue.sponsorNames,
    fills: await browser.fills(pages),
  };
}
