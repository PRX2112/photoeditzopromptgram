import { AdminShell } from "@/components/layout/AdminShell";
import { PromptForm } from "@/components/prompts/PromptForm";
import { dbService } from "@/lib/db-service";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditPromptPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const prompt = await dbService.getPromptById(id);

  if (!prompt) {
    notFound();
  }

  return (
    <AdminShell
      title={`Edit: ${prompt.title}`}
      subtitle="Modify camera prompt settings, tags, or public slug"
    >
      <PromptForm initialData={prompt} isEditing={true} />
    </AdminShell>
  );
}
