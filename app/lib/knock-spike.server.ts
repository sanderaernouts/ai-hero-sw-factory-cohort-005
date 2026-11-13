// PROTOTYPE — throwaway Knock spike for "Does Knock hold up against Cadence?"
// (issue #25). Not production code: no tests, minimal error handling.
// Lives on the prototype/knock-spike branch only.
import Knock from "@knocklabs/node";
import { signUserToken } from "@knocklabs/node/lib/tokenSigner";

// The app doesn't load .env yet (see #21); Node 22 can do it natively.
let envLoaded = false;
function loadEnv() {
  if (envLoaded) return;
  envLoaded = true;
  try {
    process.loadEnvFile(".env");
  } catch {
    // no .env — fall through, the env checks below will report it
  }
}

export function knockEnv() {
  loadEnv();
  const env = {
    publicKey: process.env.KNOCK_PUBLIC_API_KEY,
    secretKey: process.env.KNOCK_SECRET_API_KEY,
    signingKey: process.env.KNOCK_SIGNING_KEY,
    feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID,
  };
  const missing = Object.entries(env)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) throw new Error(`Missing Knock env: ${missing.join(", ")}`);
  return env as Record<keyof typeof env, string>;
}

// Workflow keys the spike expects to exist (and be committed) in Knock's
// Development environment.
export const WORKFLOWS = {
  discussionReply: "discussion-reply", // category: discussion
  newEnrollment: "new-enrollment", // category: enrollment (off by default)
} as const;
export const ENROLLMENT_CATEGORY = "enrollment";

let client: Knock | undefined;
export function knock() {
  if (!client) client = new Knock({ apiKey: knockEnv().secretKey });
  return client;
}

export const knockUserId = (id: number) => String(id);

// Check 1: our server signs an RS256 token for whichever user DevUI selected.
export async function signTokenFor(userId: number) {
  return signUserToken(knockUserId(userId), {
    signingKey: knockEnv().signingKey,
    expiresInSeconds: 60 * 60,
  });
}

export async function identify(user: { id: number; name: string; email: string }) {
  await knock().users.update(knockUserId(user.id), {
    name: user.name,
    email: user.email,
  });
}

// Check 1 (negative): with enhanced security ON, the feed must reject a
// request that has the public key but no signed user token.
export async function probeFeed(userId: number, token?: string) {
  const { publicKey, feedChannelId } = knockEnv();
  const res = await fetch(
    `https://api.knock.app/v1/users/${knockUserId(userId)}/feeds/${feedChannelId}?page_size=1`,
    {
      headers: {
        Authorization: `Bearer ${publicKey}`,
        ...(token ? { "X-Knock-User-Token": token } : {}),
      },
    }
  );
  return { status: res.status, body: (await res.text()).slice(0, 200) };
}

// Check 2: Discussion Reply → question author, from the Node SDK.
export async function triggerDiscussionReply(args: {
  replier: { id: number; name: string; email: string };
  questionAuthor: { id: number; name: string; email: string };
  questionId: number;
  replyBody: string;
  lessonTitle: string;
  url: string;
}) {
  return knock().workflows.trigger(WORKFLOWS.discussionReply, {
    actor: {
      id: knockUserId(args.replier.id),
      name: args.replier.name,
      email: args.replier.email,
    },
    recipients: [
      {
        id: knockUserId(args.questionAuthor.id),
        name: args.questionAuthor.name,
        email: args.questionAuthor.email,
      },
    ],
    data: {
      question_id: args.questionId,
      reply_excerpt: args.replyBody.slice(0, 140),
      lesson_title: args.lessonTitle,
      url: args.url,
    },
  });
}

// Check 4: new Enrollment → Instructor, off by default, opt-in.
export async function triggerNewEnrollment(args: {
  instructor: { id: number; name: string; email: string };
  student: { id: number; name: string; email: string };
  courseTitle: string;
}) {
  return knock().workflows.trigger(WORKFLOWS.newEnrollment, {
    actor: {
      id: knockUserId(args.student.id),
      name: args.student.name,
      email: args.student.email,
    },
    recipients: [knockUserId(args.instructor.id)],
    data: { course_title: args.courseTitle },
  });
}

export async function getPreferences(userId: number) {
  return knock().users.getPreferences(knockUserId(userId), "default");
}

export async function setEnrollmentFeedPreference(userId: number, on: boolean) {
  return knock().users.setPreferences(knockUserId(userId), "default", {
    __persistence_strategy__: "merge",
    categories: { [ENROLLMENT_CATEGORY]: { channel_types: { in_app_feed: on } } },
  });
}

// Reset the user's own preference so the environment default shows through.
export async function clearPreferences(userId: number) {
  return knock().users.unsetPreferences(knockUserId(userId), "default");
}
