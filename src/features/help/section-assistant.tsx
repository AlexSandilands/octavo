import { AssistantUsageHelp } from "./assistant-usage";
import { GuideSection } from "./guide-ui";

// The editing assistant (epic #306). #309 writes the section's body; the
// usage paragraph (#314) closes it.
export function SectionAssistant() {
  return (
    <GuideSection
      id="assistant"
      kicker="Editing assistant"
      title="The assistant"
    >
      <AssistantUsageHelp />
    </GuideSection>
  );
}
