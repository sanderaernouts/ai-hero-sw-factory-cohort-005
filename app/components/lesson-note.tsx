import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import {
  describeNoteDraft,
  type NoteDraft,
  type NoteStatus,
  type SavedNote,
} from "~/modules/lesson-note";
import { cn, formatRelativeTime } from "~/lib/utils";

export function LessonNote({ note }: { note: SavedNote | null }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [draft, setDraft] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const view = describeNoteDraft({
    draft,
    saved: note,
    error: fetcher.data?.error,
  });

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <LessonNoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            className="min-h-24 resize-y"
          />

          <LessonNoteFooter view={view} isSaving={isSaving} />
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function LessonNoteFooter({
  view,
  isSaving,
}: {
  view: NoteDraft;
  isSaving: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" size="sm" disabled={isSaving || !view.canSave}>
        {isSaving ? "Saving..." : "Save note"}
      </Button>

      <NoteStatusText status={view.status} />

      <span
        className={cn(
          "ml-auto text-xs",
          view.overLimit ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {view.length} / {view.maxLength}
      </span>
    </div>
  );
}

function LessonNoteHeader() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <NotebookPen className="size-5 text-primary" />
      <h2 className="text-xl font-semibold">Your notes</h2>
      <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Private to you
      </span>
    </div>
  );
}

function NoteStatusText({ status }: { status: NoteStatus }) {
  switch (status.kind) {
    case "error":
      return (
        <span role="alert" className="text-sm text-destructive">
          {status.message}
        </span>
      );
    case "unsaved":
      return (
        <span className="text-xs text-muted-foreground">Unsaved changes</span>
      );
    case "blank":
      return (
        <span className="text-xs text-muted-foreground">
          A note can't be empty
        </span>
      );
    case "saved":
      return (
        <span
          suppressHydrationWarning
          className="text-xs text-muted-foreground"
        >
          Saved · last edited {formatRelativeTime(status.updatedAt)}
        </span>
      );
    case "empty":
      return null;
  }
}
