import type { EmailRound, EngineConfig } from '../types/rfq';
import { validateAndGroundLlmOutput, type GroundingValidationOutcome } from './groundingValidator';

const SYSTEM_PROMPT = `You are a strict sheet-metal RFQ information extraction parser.
Extract ONLY facts explicitly stated in each email round. NEVER invent, guess, or default any specification (for example, NEVER output "304", "5052", or "1.5 mm" unless verbatim present in that email round).
Return valid JSON matching this schema:
{
  "rounds": [
    {
      "roundNumber": 1,
      "zhTranslation": "Natural Chinese translation of this entire email round",
      "scopeWarnings": ["string"],
      "partType": { "value": "brackets", "zhLabel": "折弯支架", "quotes": ["exact substring from round"] },
      "material": { "family": "stainless steel", "zhFamily": "不锈钢", "grade": "304", "isHistoryRef": false, "quotes": ["exact substring"] },
      "thickness": { "valueDisplay": "1.5 mm", "isHistoryRef": false, "quotes": ["exact substring"] },
      "quantity": { "values": [500, 2000], "mode": "single|tiered|revised|ambiguous|confirm_previous", "isOnly": false, "quotes": ["exact substring"] },
      "drawing": { "state": "attached|sketch_only|pending_customer|check_history|missing", "formatDetail": "STEP", "quotes": ["exact substring"] },
      "surfaceFinish": { "valueDisplay": "拉丝", "zhLabel": "拉丝", "isChoiceAmbiguous": false, "choiceOptions": [], "missingColorDetail": false, "isExplicitRaw": false, "isHistoryRef": false, "quotes": ["exact substring"] },
      "toleranceAndFeatures": { "numericTolerance": "±0.2 mm", "vagueTightTolerance": false, "secondaryOps": [], "quotes": ["exact substring"] },
      "deliveryTerms": { "incoterm": "FOB Shenzhen", "leadTime": "2 weeks", "isUrgent": false, "quotes": ["exact substring"] }
    }
  ]
}
Every extracted section MUST include "quotes": an array of exact verbatim substrings copied character-for-character from that round's email text. Omit fields not mentioned in that round.`;

export async function extractRoundsWithLlm(
  rounds: EmailRound[],
  config: EngineConfig,
): Promise<GroundingValidationOutcome> {
  const userContent = rounds
    .map((r) => `Round ${r.roundNumber} (${r.label}):\n"""\n${r.text}\n"""`)
    .join('\n\n');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];

  let response: Response;
  if (config.mode === 'llm_proxy') {
    response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
  } else {
    const baseUrl = config.baseUrl.replace(/\/+$/, '');
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages,
      }),
    });
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${errBody.slice(0, 140)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM 返回内容为空');
  }

  const parsedJson = JSON.parse(content) as unknown;
  return validateAndGroundLlmOutput(rounds, parsedJson);
}
