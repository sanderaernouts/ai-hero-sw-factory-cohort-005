// PROTOTYPE — throwaway Knock spike for "Does Knock hold up against Cadence?"
// (issue #25). Visit /prototype/knock-spike, switch users with the DevUI panel.
import { useEffect, useRef, useState } from "react";
import { Form, useNavigation } from "react-router";
import Knock, { type Feed, type FeedItem, type FeedMetadata } from "@knocklabs/client";
import type { Route } from "./+types/prototype.knock-spike";
import { getCurrentUserId } from "~/lib/session";
import { db } from "~/db";
import { comments, courses, lessons, modules, users, UserRole } from "~/db/schema";
import { and, eq, isNull, ne } from "drizzle-orm";
import {
  clearPreferences,
  getPreferences,
  identify,
  knockEnv,
  knockUserId,
  probeFeed,
  setEnrollmentFeedPreference,
  signTokenFor,
  triggerDiscussionReply,
  triggerNewEnrollment,
  WORKFLOWS,
} from "~/lib/knock-spike.server";
import { Button } from "~/components/ui/button";

function currentUser(id: number | null) {
  if (id === null) throw new Response("Select a user from the DevUI panel", { status: 401 });
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) throw new Response("Select a user from the DevUI panel", { status: 401 });
  return user;
}

// Discussion Questions written by someone other than the current user — the
// current user plays the replier, the author is the recipient.
function otherPeoplesQuestions(userId: number) {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      authorId: users.id,
      authorName: users.name,
      lessonTitle: lessons.title,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .innerJoin(lessons, eq(lessons.id, comments.lessonId))
    .where(and(isNull(comments.parentId), isNull(comments.deletedAt), ne(comments.userId, userId)))
    .limit(8)
    .all();
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = currentUser(await getCurrentUserId(request));
  const env = knockEnv();
  await identify(user);
  const token = await signTokenFor(user.id);
  const [unsigned, signed, preferences] = await Promise.all([
    probeFeed(user.id),
    probeFeed(user.id, token),
    getPreferences(user.id).catch((e: Error) => ({ error: e.message })),
  ]);
  return {
    user: { id: user.id, name: user.name, role: user.role },
    knockUserId: knockUserId(user.id),
    token,
    publicKey: env.publicKey,
    feedChannelId: env.feedChannelId,
    probes: { unsigned, signed },
    preferences,
    questions: otherPeoplesQuestions(user.id),
    workflows: WORKFLOWS,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = currentUser(await getCurrentUserId(request));
  const form = await request.formData();
  const intent = form.get("intent");
  try {
    if (intent === "reply") {
      const questionId = Number(form.get("questionId"));
      const q = db
        .select({ authorId: comments.userId, lessonTitle: lessons.title, lessonId: lessons.id })
        .from(comments)
        .innerJoin(lessons, eq(lessons.id, comments.lessonId))
        .where(eq(comments.id, questionId))
        .get();
      if (!q) return { result: "No such question" };
      const author = db.select().from(users).where(eq(users.id, q.authorId)).get()!;
      await identify(author);
      const res = await triggerDiscussionReply({
        replier: user,
        questionAuthor: author,
        questionId,
        replyBody: `PROTOTYPE reply from ${user.name} at ${new Date().toLocaleTimeString()}`,
        lessonTitle: q.lessonTitle,
        url: `/prototype/knock-spike#question-${questionId}`,
      });
      return { result: `Triggered ${WORKFLOWS.discussionReply} → ${author.name} (user ${author.id}). workflow_run_id=${res.workflow_run_id}` };
    }
    if (intent === "enrollment") {
      if (user.role !== UserRole.Instructor) return { result: "Switch to an Instructor first" };
      const course = db
        .select({ title: courses.title })
        .from(courses)
        .where(eq(courses.instructorId, user.id))
        .get();
      const student = db.select().from(users).where(eq(users.role, UserRole.Student)).get()!;
      await identify(student);
      const res = await triggerNewEnrollment({
        instructor: user,
        student,
        courseTitle: course?.title ?? "(no course)",
      });
      return { result: `Triggered ${WORKFLOWS.newEnrollment} → ${user.name}. workflow_run_id=${res.workflow_run_id}` };
    }
    if (intent === "opt-in" || intent === "opt-out") {
      await setEnrollmentFeedPreference(user.id, intent === "opt-in");
      return { result: `Set enrollment.in_app_feed=${intent === "opt-in"} for ${user.name}` };
    }
    if (intent === "reset-prefs") {
      await clearPreferences(user.id);
      return { result: `Cleared ${user.name}'s own preference set (environment default applies)` };
    }
    return { result: `Unknown intent ${String(intent)}` };
  } catch (e) {
    return { result: `ERROR: ${(e as Error).message}` };
  }
}

type Log = { at: string; msg: string };

function useHeadlessFeed(args: { publicKey: string; userId: string; token: string; channelId: string }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [meta, setMeta] = useState<FeedMetadata | null>(null);
  const [log, setLog] = useState<Log[]>([]);
  const feedRef = useRef<Feed | null>(null);
  const push = (msg: string) =>
    setLog((l) => [{ at: new Date().toLocaleTimeString(), msg }, ...l].slice(0, 30));

  useEffect(() => {
    // A fresh client per DevUI user, so switching users really re-authenticates.
    const knock = new Knock(args.publicKey);
    knock.authenticate({ id: args.userId }, args.token);
    const feed = knock.feeds.initialize(args.channelId, { page_size: 20, archived: "exclude" });
    feedRef.current = feed;
    const sync = () => {
      const s = feed.getState();
      setItems([...s.items]);
      setMeta({ ...s.metadata });
    };
    const unsub = feed.store.subscribe(sync);
    feed.on("items.received.realtime", () => push("realtime: new item over socket"));
    feed.listenForUpdates();
    feed
      .fetch()
      .then((r) => push(`fetch for user ${args.userId}: ${r?.status ?? "?"}`))
      .catch((e: Error) => push(`fetch error: ${e.message}`));
    return () => {
      unsub();
      feed.teardown();
      knock.teardown();
    };
  }, [args.publicKey, args.userId, args.token, args.channelId]);

  const run = (label: string, p: Promise<unknown> | undefined) =>
    p?.then(() => push(`${label}: ok`)).catch((e: Error) => push(`${label}: ${e.message}`));

  return { items, meta, log, feed: feedRef, run };
}

function Check({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4 space-y-3">
      <h2 className="font-semibold">
        Check {n}: {title}
      </h2>
      {children}
    </section>
  );
}

export default function KnockSpike({ loaderData, actionData }: Route.ComponentProps) {
  const d = loaderData;
  const nav = useNavigation();
  const { items, meta, log, feed, run } = useHeadlessFeed({
    publicKey: d.publicKey,
    userId: d.knockUserId,
    token: d.token,
    channelId: d.feedChannelId,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6 text-sm">
      <div className="rounded border-2 border-dashed border-amber-500 bg-amber-50 p-3 dark:bg-amber-950/30">
        <strong>PROTOTYPE</strong>: Knock spike for “Does Knock hold up against Cadence?” Throwaway.
      </div>
      <p>
        Signed in as <strong>{d.user.name}</strong> ({d.user.role}), Knock user id{" "}
        <code>{d.knockUserId}</code>. Switch users in the DevUI panel.
      </p>
      {actionData?.result && (
        <pre className="whitespace-pre-wrap rounded bg-muted p-2">{actionData.result}</pre>
      )}

      <Check n={1} title="Signed user tokens">
        <ul className="list-disc pl-5">
          <li>
            Feed with public key, <em>no</em> user token: HTTP <strong>{d.probes.unsigned.status}</strong>{" "}
            {d.probes.unsigned.status >= 400 && d.probes.unsigned.status < 500
              ? "✅ rejected (enhanced security is on)"
              : "❌ accepted, so enhanced security is OFF and this proves nothing"}
          </li>
          <li>
            Feed with our RS256 token: HTTP <strong>{d.probes.signed.status}</strong>{" "}
            {d.probes.signed.status === 200 ? "✅" : `❌ ${d.probes.signed.body}`}
          </li>
        </ul>
        <details>
          <summary>Token (sub should be {d.knockUserId})</summary>
          <pre className="whitespace-pre-wrap break-all">{d.token}</pre>
          <pre>{JSON.stringify(JSON.parse(atob(d.token.split(".")[1]!)), null, 2)}</pre>
          <pre>{JSON.stringify(JSON.parse(atob(d.token.split(".")[0]!)), null, 2)}</pre>
        </details>
      </Check>

      <Check n={2} title={`Trigger Discussion Reply (workflow "${d.workflows.discussionReply}")`}>
        <p>You reply as {d.user.name}. The question’s author gets the Notification. Switch to them to see it.</p>
        <ul className="space-y-1">
          {d.questions.map((q) => (
            <li key={q.id} className="flex items-center gap-2">
              <Form method="post">
                <input type="hidden" name="intent" value="reply" />
                <input type="hidden" name="questionId" value={q.id} />
                <Button size="sm" variant="outline" disabled={nav.state !== "idle"}>
                  Reply
                </Button>
              </Form>
              <span>
                <strong>{q.authorName}</strong> (user {q.authorId}) on “{q.lessonTitle}”: {q.body.slice(0, 60)}
              </span>
            </li>
          ))}
        </ul>
      </Check>

      <Check n={3} title="Headless feed API (@knocklabs/client)">
        <p>
          unread_count: <strong>{meta?.unread_count ?? "…"}</strong> · unseen_count:{" "}
          <strong>{meta?.unseen_count ?? "…"}</strong> · total: {meta?.total_count ?? "…"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => run("markAllAsSeen", feed.current?.markAllAsSeen())}>
            Mark all seen
          </Button>
          <Button size="sm" variant="outline" onClick={() => run("markAllAsRead", feed.current?.markAllAsRead())}>
            Mark all read
          </Button>
          <Button size="sm" variant="outline" onClick={() => run("refetch", feed.current?.fetch())}>
            Refetch
          </Button>
        </div>
        <ul className="divide-y rounded border">
          {items.length === 0 && <li className="p-2 text-muted-foreground">No items</li>}
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 p-2">
              <span className={it.read_at ? "opacity-50" : "font-medium"}>
                [{it.source.key}] {(it.actors[0] as { name?: string } | undefined)?.name ?? "?"} · {JSON.stringify(it.data)}
              </span>
              <span className="ml-auto whitespace-nowrap text-xs">
                {it.seen_at ? "seen" : "unseen"} / {it.read_at ? "read" : "unread"}
              </span>
              <Button size="sm" variant="ghost" onClick={() => run("markAsSeen", feed.current?.markAsSeen(it))}>
                seen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => run("markAsRead", feed.current?.markAsRead(it))}>
                read
              </Button>
              <Button size="sm" variant="ghost" onClick={() => run("markAsUnread", feed.current?.markAsUnread(it))}>
                unread
              </Button>
            </li>
          ))}
        </ul>
        <pre className="max-h-40 overflow-auto rounded bg-muted p-2">
          {log.map((l) => `${l.at}  ${l.msg}`).join("\n")}
        </pre>
      </Check>

      <Check n={4} title={`Opt-in preference (workflow "${d.workflows.newEnrollment}", category "enrollment")`}>
        <p>Instructors only. With no preferences of your own, the environment default should hold the trigger back.</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["enrollment", "Trigger new Enrollment → me"],
              ["opt-in", "Opt in (feed)"],
              ["opt-out", "Opt out (feed)"],
              ["reset-prefs", "Clear my prefs"],
            ] as const
          ).map(([intent, label]) => (
            <Form method="post" key={intent}>
              <input type="hidden" name="intent" value={intent} />
              <Button size="sm" variant="outline" disabled={nav.state !== "idle"}>
                {label}
              </Button>
            </Form>
          ))}
        </div>
        <details open>
          <summary>My merged preference set (from Knock)</summary>
          <pre className="whitespace-pre-wrap">{JSON.stringify(d.preferences, null, 2)}</pre>
        </details>
      </Check>
    </div>
  );
}
