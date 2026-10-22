import { AdminShell } from "@/components/layout/AdminShell";
import { PromptForm } from "@/components/prompts/PromptForm";

export default function NewPromptPage() {
  return (
    <AdminShell
      title="Create Photography Prompt"
      subtitle="Define a new camera prompt, lens settings, and public slug for Instagram comment delivery"
    >
      <PromptForm />
    </AdminShell>
  );
}
