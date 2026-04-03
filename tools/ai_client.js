import Anthropic from '@anthropic-ai/sdk';

let _client = null;

function getClient() {
  if (_client) return _client;

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.LOCAL_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('AI-tjenesten er ikke satt opp ennå (mangler ANTHROPIC_API_KEY)');
  }

  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Sender en melding til Claude og returnerer svaret som tekst.
 * @param {string} systemPrompt - Instruksjoner til Claude om hvordan den skal oppføre seg
 * @param {string} userMessage - Innholdet som skal analyseres
 * @returns {Promise<string>} - Claudes svar som tekst
 */
export async function callClaude(systemPrompt, userMessage) {
  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  return response.content[0].text;
}
