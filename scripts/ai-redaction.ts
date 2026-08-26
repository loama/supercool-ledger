export interface RedactableMessage {
  role: 'assistant' | 'user';
  text: string;
}

const PRIVATE_CONTEXT = '[REDACTED: private workspace context]';
const CREDENTIAL_EXCHANGE = '[REDACTED: private credential search exchange]';
const HOSTING_CONTEXT = '[REDACTED: private hosting account context]';
const LOCAL_PATH = '[REDACTED_LOCAL_PATH]';

const redactCommon = (value: string): string =>
  value
    .replace(
      /<(environment_context|in-app-browser-context)(?:\s[^>]*)?>[\s\S]*?<\/\1>/giu,
      PRIVATE_CONTEXT,
    )
    .replace(/https?:\/\/dashboard\.render\.com\/[^\s)>\]]+/giu, '[REDACTED_HOSTING_URL]')
    .replace(/https?:\/\/elevenlabs\.io\/app\/sign-in/giu, '[REDACTED_ACCOUNT_URL]')
    .replace(/\bdep-[a-z0-9]{16,}\b/giu, '[REDACTED_DEPLOYMENT_ID]')
    .replace(/file:\/\/\/Users\/[^\s)>\]]+/giu, LOCAL_PATH)
    .replace(/\/Users\/[^\s)>\]]+/gu, LOCAL_PATH)
    .replace(/\[([^\]\n]+)\]\(\[REDACTED_LOCAL_PATH\]\)/gu, '$1 [REDACTED_LOCAL_PATH]')
    .replace(/Eduardo López’s Workspace/giu, '[REDACTED_PRIVATE_WORKSPACE]')
    .replace(/\bSupervisor\b/giu, '[REDACTED_UNRELATED_PROJECT]')
    .replace(/\bbasic_256mb\b/giu, '[REDACTED_DATABASE_PLAN]')
    .replace(/\$7 per month/giu, '[REDACTED_MONTHLY_PRICE]');

const startsCredentialExchange = (value: string): boolean =>
  /find the api key[\s\S]*(?:supervisor|chrome)|check the Supervisor environment files/iu.test(
    value,
  );

const belongsToCredentialExchange = (value: string): boolean =>
  /credential search result|API key inventory|saved account state is redacted/iu.test(value);

const containsPrivateHostingContext = (value: string): boolean =>
  /Eduardo López’s Workspace|paid Render service|smallest paid PostgreSQL|paid PostgreSQL 17|basic_256mb|\$7 per month|saved Render login|saved credentials|authenticated Render (?:tab|dashboard)|Render.*signed in|signed into github|enabled API keys/iu.test(
    value,
  );

export const redactConversationMessages = <T extends RedactableMessage>(messages: T[]): T[] => {
  let credentialExchange = false;
  return messages.map((message) => {
    const original = message.text;
    if (startsCredentialExchange(original)) credentialExchange = true;
    if (credentialExchange && /The new narration finished/iu.test(original)) {
      credentialExchange = false;
    }
    if (credentialExchange || belongsToCredentialExchange(original)) {
      return { ...message, text: CREDENTIAL_EXCHANGE };
    }
    if (containsPrivateHostingContext(original)) {
      return { ...message, text: HOSTING_CONTEXT };
    }
    return { ...message, text: redactCommon(original) };
  });
};

export const redactReviewRecord = (value: string): string => redactCommon(value);
