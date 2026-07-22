import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function loadHelpers() {
  const source = await readFile(new URL('../src/lib/crmMessages.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

test('les demandes publiques apparaissent comme conversations Public séparées', async () => {
  const { groupMessagesForCrm } = await loadHelpers();
  const rows = [
    {
      id: 'public-1',
      sender_id: null,
      sender_name: 'Salma',
      sender_kind: 'public',
      recipient_id: null,
      text: 'Nom: Salma\nTéléphone: 0612345678\nMessage: Bonjour',
      timestamp: '2026-07-22T14:00:00.000Z',
    },
    {
      id: 'client-1',
      sender_id: 'user-1',
      sender_name: 'Ali',
      sender_kind: 'client',
      recipient_id: null,
      text: 'Question client',
      timestamp: '2026-07-22T13:00:00.000Z',
    },
    {
      id: 'admin-1',
      sender_id: null,
      sender_name: 'Administrateur EAUMALIK',
      sender_kind: 'admin',
      recipient_id: 'user-1',
      text: 'Réponse admin',
      timestamp: '2026-07-22T13:05:00.000Z',
    },
  ];

  const conversations = groupMessagesForCrm(rows, [
    { id: 'user-1', full_name: 'Ali Client', email: 'ali@example.com' },
  ]);

  assert.equal(conversations.length, 2);
  assert.equal(conversations[0].clientId, 'public:public-1');
  assert.equal(conversations[0].clientName, 'Salma');
  assert.equal(conversations[0].clientEmail, 'Visiteur non inscrit');
  assert.equal(conversations[0].isPublic, true);
  assert.equal(conversations[1].isPublic, false);
  assert.equal(conversations[1].messages.length, 2);
});

test('les anciennes demandes sans sender_kind restent reconnues comme publiques', async () => {
  const { normalizeMessage } = await loadHelpers();
  const message = normalizeMessage({
    id: 'legacy-public',
    sender_id: null,
    sender_name: 'Ancien visiteur',
    recipient_id: null,
    text: 'Question',
  });

  assert.equal(message.senderKind, 'public');
  assert.equal(message.senderId, 'public:legacy-public');
});
