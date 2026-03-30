import Anthropic from '@anthropic-ai/sdk';

const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? process.env.LOCAL_ANTHROPIC_API_KEY;
const client = new Anthropic({ apiKey: anthropicApiKey });

/**
 * Sender en melding til Claude og returnerer svaret som tekst.
 * @param {string} systemPrompt - Instruksjoner til Claude om hvordan den skal oppføre seg
 * @param {string} userMessage - Innholdet som skal analyseres
 * @returns {Promise<string>} - Claudes svar som tekst
 */
export async function callClaude(systemPrompt, userMessage) {
  if (!anthropicApiKey) {
    throw new Error('AI-tjenesten er ikke satt opp ennå');
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  });

  return response.content[0].text;
}
