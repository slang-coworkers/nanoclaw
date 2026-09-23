import { describe, expect, it } from 'vitest';

import { scrubSecrets, totalRedactions } from './scrub.js';

// All fixtures below are SYNTHETIC — shaped to match the redaction patterns but
// carrying "EXAMPLE"/"FAKE" markers so they are never mistaken for real secrets
// (and never trip secret-scanning push protection).
const REDACTED = /\[REDACTED[:\]]/;

describe('scrubSecrets — redacts real credential shapes', () => {
  const positives: Array<[string, string]> = [
    ['gitlab-pat', 'token glpat-EXAMPLEfakeGitlabToken123 here'],
    ['github-pat', 'gh github_pat_EXAMPLEfake0000000000_abcdefghij1234567890abcdefghijZZ end'],
    ['github-classic', 'ghp_EXAMPLEfake0000abcdefghijABCDEFGHIJ0123'],
    ['slack-bot', 'xoxb-EXAMPLE00000-EXAMPLE0000000-fakeSlackBotTokenExample'],
    ['slack-app', 'xapp-1-EXAMPLE00000-0000000000-fakeExampleAppToken'],
    ['slack-webhook', 'post to https://hooks.slack.com/services/T000EXAMPLE/B000FAKE/xxxxYYYYzzzz'],
    ['anthropic', 'sk-ant-api03-EXAMPLEfakeAnthropicKey_placeholder123'],
    ['openai/inference', 'key sk-EXAMPLEfakeInferenceKeyXXXXXX more'],
    ['nvidia', 'nvapi-EXAMPLEfakeNvidiaKeyXXXXXXXXXX'],
    ['aws-akia', 'AKIAEXAMPLEFAKE00000'],
    ['aws-asia-temp', 'ASIAEXAMPLEFAKE00000'],
    ['google', 'AIzaSyEXAMPLEfake0000000000000000000ab'],
    ['jwt', 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJleGFtcGxlIn0.ZXhhbXBsZXNpZw'],
    ['bearer', 'Authorization: Bearer EXAMPLEfakeBearerToken0123456789'],
    ['basic-auth-url', 'git clone https://user:EXAMPLEfakepass@gitlab-master.nvidia.com/x/y.git'],
    ['assignment', 'GITLAB_ACCESS_TOKEN=glpat-EXAMPLEfake1234567890abcd'],
    ['assignment-json', '"client_secret": "EXAMPLEfakeSecretValue123"'],
  ];
  for (const [name, input] of positives) {
    it(`redacts ${name}`, () => {
      const { text, redactions } = scrubSecrets(input);
      expect(text).toMatch(REDACTED);
      expect(totalRedactions(redactions)).toBeGreaterThan(0);
    });
  }

  it('redacts a full PEM private-key block, matching BEGIN/END label', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nEXAMPLEfakeBase64Body...\n-----END RSA PRIVATE KEY-----';
    const { text } = scrubSecrets(`before\n${pem}\nafter`);
    expect(text).toContain('before');
    expect(text).toContain('after');
    expect(text).not.toContain('EXAMPLEfakeBase64Body');
    expect(text).toMatch(/\[REDACTED:private-key\]/);
  });

  it('keeps the URL scheme when redacting basic-auth credentials', () => {
    const { text } = scrubSecrets('https://user:EXAMPLEfakepass@host/path');
    expect(text).toContain('https://');
    expect(text).toContain('@host/path');
    expect(text).not.toContain('EXAMPLEfakepass@');
  });
});

describe('scrubSecrets — does NOT over-redact', () => {
  const negatives: string[] = [
    'Set API_KEY=${MY_API_KEY} from the environment.',
    'export TOKEN=$GH_TOKEN',
    'password: <your-password-here>',
    'MAX_TOKENS=12000 controls the limit',
    'client_secret: changeme',
    'The reviewer verified the diff against the runtime path it runs on.',
    'PR 12834 never-written varying field is undef in review.',
    'Use the placeholder {{SLACK_TOKEN}} in the template.',
  ];
  for (const input of negatives) {
    it(`leaves prose/placeholder intact: ${input.slice(0, 32)}…`, () => {
      const { text, redactions } = scrubSecrets(input);
      expect(text).toBe(input);
      expect(redactions).toHaveLength(0);
    });
  }
});
