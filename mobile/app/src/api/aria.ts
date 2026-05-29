import { mobileAuthFetch } from './mobileAuth';

type MobileAriaMessage = {
  content: string;
  role: 'assistant' | 'user';
};

type AriaStreamPayload =
  | { type: 'content'; content?: string }
  | { type: 'status'; message?: string }
  | { type: 'error'; error?: string }
  | { type: 'done' }
  | { type: string; [key: string]: unknown };

function parseAriaStream(text: string) {
  let reply = '';
  let error = '';

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.startsWith('data: ')) continue;
    const payload = rawLine.slice(6).trim();
    if (!payload || payload === '[DONE]') continue;

    try {
      const parsed = JSON.parse(payload) as AriaStreamPayload;
      if (parsed.type === 'content') {
        reply += parsed.content ?? '';
      } else if (parsed.type === 'status') {
        reply += `\n\n${parsed.message ?? ''}`.trimEnd();
      } else if (parsed.type === 'error') {
        error = parsed.error || 'Aria could not respond right now.';
      }
    } catch {
      // Ignore non-JSON stream lines.
    }
  }

  if (error) throw new Error(error);
  return reply.trim() || 'Aria finished, but did not send a reply. Please try again.';
}

export async function sendMobileAriaMessage(messages: MobileAriaMessage[]) {
  const response = await mobileAuthFetch('/api/aria/chat', {
    body: JSON.stringify({
      messages,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    method: 'POST',
  });

  if (!response) {
    throw new Error('Sign in is required to use Aria on the mobile app.');
  }

  if (!response.ok) {
    let message = 'Aria could not respond right now.';
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error || body.message || message;
    } catch {
      // Keep the generic message when the server does not send JSON.
    }
    throw new Error(message);
  }

  return parseAriaStream(await response.text());
}
