const assert = require('node:assert/strict');
const { mock, test } = require('node:test');
const { generateAnswer, GeminiError } = require('../src/services/geminiService');

test('sends conversation history to Gemini and returns its answer', async (context) => {
  const originalKey = process.env.AI_API_KEY;
  const originalModel = process.env.AI_MODEL;
  context.after(() => {
    if (originalKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.AI_MODEL;
    else process.env.AI_MODEL = originalModel;
  });

  process.env.AI_API_KEY = 'unit-test-key';
  process.env.AI_MODEL = 'gemini-2.5-flash';
  let requestUrl;
  let requestOptions;
  mock.method(global, 'fetch', async (url, options) => {
    requestUrl = url;
    requestOptions = options;
    return Response.json({
      candidates: [{ content: { parts: [{ text: 'Rinse the stain promptly and follow the care label.' }] } }]
    });
  });

  const answer = await generateAnswer('How do I remove a stain?', [
    { role: 'user', content: 'It is on cotton.' },
    { role: 'assistant', content: 'What kind of fabric is it?' }
  ]);

  assert.match(requestUrl, /gemini-2\.5-flash:generateContent/);
  assert.doesNotMatch(requestUrl, /unit-test-key/);
  assert.equal(requestOptions.headers['x-goog-api-key'], 'unit-test-key');
  assert.deepEqual(JSON.parse(requestOptions.body).contents.map((item) => item.role), ['user', 'model', 'user']);
  assert.match(answer, /Rinse the stain/);
});

test('reports missing Gemini configuration explicitly', async (context) => {
  const originalKey = process.env.AI_API_KEY;
  context.after(() => {
    if (originalKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = originalKey;
  });
  delete process.env.AI_API_KEY;

  await assert.rejects(
    generateAnswer('How do I wash wool?'),
    (error) => error instanceof GeminiError && error.statusCode === 503 && /AI_API_KEY/.test(error.message)
  );
});

test('reports invalid Gemini credentials without exposing provider details', async (context) => {
  const originalKey = process.env.AI_API_KEY;
  context.after(() => {
    if (originalKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = originalKey;
  });
  process.env.AI_API_KEY = 'unit-test-key';
  mock.method(global, 'fetch', async () => Response.json(
    { error: { status: 'PERMISSION_DENIED', message: 'private provider diagnostic' } },
    { status: 403 }
  ));

  await assert.rejects(
    generateAnswer('Can you help?'),
    (error) => error instanceof GeminiError &&
      error.statusCode === 503 &&
      /rejected the configured API key/.test(error.message) &&
      !/private provider diagnostic/.test(error.message)
  );
});

test('reports Gemini network failures as an actionable backend error', async (context) => {
  const originalKey = process.env.AI_API_KEY;
  context.after(() => {
    if (originalKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = originalKey;
  });
  process.env.AI_API_KEY = 'unit-test-key';
  mock.method(global, 'fetch', async () => {
    const error = new TypeError('fetch failed');
    error.cause = { code: 'ECONNRESET' };
    throw error;
  });

  await assert.rejects(
    generateAnswer('Can you help?'),
    (error) => error instanceof GeminiError &&
      error.statusCode === 502 &&
      /EcoSwap backend could not reach Google Gemini/.test(error.message)
  );
});
