const AUTO_LAYOUT_BACKEND_VERSION = 'v2.2-dual-function-call-2026-10-06';

type AutoLayoutProperty =
  | 'headlineFontSize'
  | 'headlineLineHeight'
  | 'bodyFontSize'
  | 'bodyLineHeight'
  | 'tagHeadlineOffset'
  | 'headlineBodyOffset'
  | 'imageScale'
  | 'imageOffsetX'
  | 'imageOffsetY';

const LIMITS: Record<AutoLayoutProperty, { min: number; max: number }> = {
  headlineFontSize: { min: 8, max: 250 },
  headlineLineHeight: { min: 0.5, max: 2 },
  bodyFontSize: { min: 8, max: 250 },
  bodyLineHeight: { min: 0.5, max: 2 },
  tagHeadlineOffset: { min: -180, max: 180 },
  headlineBodyOffset: { min: -180, max: 180 },
  imageScale: { min: 1, max: 2.5 },
  imageOffsetX: { min: -800, max: 800 },
  imageOffsetY: { min: -800, max: 800 },
};

function sanitizeAutoLayoutChanges(input: unknown) {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(Object.keys(LIMITS));
  const seen = new Set<string>();

  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as { property?: unknown; value?: unknown; reason?: unknown };
    if (typeof candidate.property !== 'string' || !allowed.has(candidate.property) || seen.has(candidate.property)) return [];
    const property = candidate.property as AutoLayoutProperty;
    const value = Number(candidate.value);
    if (!Number.isFinite(value)) return [];
    const limit = LIMITS[property];
    seen.add(property);
    return [{
      property,
      value: Math.min(limit.max, Math.max(limit.min, value)),
      ...(typeof candidate.reason === 'string' ? { reason: candidate.reason.trim().slice(0, 180) } : {}),
    }];
  }).slice(0, 9);
}

type AutoLayoutRequest = {
  state?: unknown;
  screenshotDataUrl?: string;
};

function extractJson(content: string) {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^\`\`\`(?:json)?\s*/i, '')
    .replace(/\s*\`\`\`$/i, '');
  const firstBrace = withoutFence.indexOf('{');
  const lastBrace = withoutFence.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error('A IA não retornou JSON válido.');
  return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1)) as {
    summary?: unknown;
    changes?: unknown;
  };
}

function promptFor(state: unknown) {
  return [
    'Você é o Auto Layout do FG Post Studio, um editor de social media do Favela Gaming.',
    'Analise a composição atual e proponha somente alterações objetivas nas propriedades permitidas.',
    'Não altere textos, cores, logos, assets ou o layout/template.',
    'Prefira poucas mudanças com impacto claro. Não mude uma propriedade se ela já estiver adequada.',
    'Respeite os limites informados em constraints.',
    'Use obrigatoriamente a função apply_auto_layout para devolver a resposta.',
    'Não responda em texto livre quando a função estiver disponível.',
    'Se não houver mudança útil, chame apply_auto_layout com changes: [].',
    '',
    'ESTADO ATUAL:',
    JSON.stringify(state),
  ].join('\n');
}

async function callKie(apiKey: string, state: unknown, screenshotDataUrl?: string) {
  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: promptFor(state) },
  ];
  if (screenshotDataUrl?.startsWith('data:image/')) {
    content.push({ type: 'image_url', image_url: { url: screenshotDataUrl } });
  }

  return fetch(
    process.env.KIE_AUTO_LAYOUT_ENDPOINT
      || 'https://api.kie.ai/gemini-3-7-flash-openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'apply_auto_layout',
              description: 'Return the approved Auto Layout changes for the current FG Studio composition.',
              parameters: {
                type: 'object',
                properties: {
                  summary: {
                    type: 'string',
                    description: 'Short explanation in Portuguese of the layout improvements.',
                  },
                  changes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        property: {
                          type: 'string',
                          enum: [
                            'headlineFontSize',
                            'headlineLineHeight',
                            'bodyFontSize',
                            'bodyLineHeight',
                            'tagHeadlineOffset',
                            'headlineBodyOffset',
                            'imageScale',
                            'imageOffsetX',
                            'imageOffsetY',
                          ],
                        },
                        value: { type: 'number' },
                        reason: { type: 'string' },
                      },
                      required: ['property', 'value'],
                    },
                  },
                },
                required: ['summary', 'changes'],
              },
            },
          },
        ],
        stream: false,
        include_thoughts: false,
        reasoning_effort: 'low',
      }),
    },
  );
}

async function handleAutoLayout(request: Request) {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'KIE_API_KEY não configurada no servidor.', backendVersion: AUTO_LAYOUT_BACKEND_VERSION },
      { status: 503 },
    );
  }

  let body: AutoLayoutRequest;
  try {
    body = await request.json() as AutoLayoutRequest;
  } catch {
    return Response.json({ error: 'Requisição inválida.', backendVersion: AUTO_LAYOUT_BACKEND_VERSION }, { status: 400 });
  }

  if (!body.state || typeof body.state !== 'object') {
    return Response.json({ error: 'Estado do layout ausente.', backendVersion: AUTO_LAYOUT_BACKEND_VERSION }, { status: 400 });
  }

  try {
    let response = await callKie(apiKey, body.state, body.screenshotDataUrl);
    // Alguns gateways multimodais aceitam apenas URLs públicas. Se o data URL for recusado,
    // preservamos o teste de Auto Layout usando somente o estado estruturado.
    if (!response.ok && body.screenshotDataUrl) {
      response = await callKie(apiKey, body.state);
    }

    const raw = await response.text();
    if (!response.ok) {
      return Response.json(
        { error: `Kie respondeu com status ${response.status}.`, detail: raw.slice(0, 500), backendVersion: AUTO_LAYOUT_BACKEND_VERSION },
        { status: response.status },
      );
    }

    const payload = JSON.parse(raw) as {
      choices?: Array<{
        message?: {
          content?: string | Array<{ type?: string; text?: string }>;
          tool_calls?: Array<{
            function?: {
              name?: string;
              arguments?: string;
            };
          }>;
        };
      }>;
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            functionCall?: {
              name?: string;
              args?: unknown;
            };
          }>;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
      credits_consumed?: number;
      modelVersion?: string;
    };

    let modelContent: string | null = null;

    const openAiContent = payload.choices?.[0]?.message?.content;
    if (typeof openAiContent === 'string') {
      modelContent = openAiContent;
    } else if (Array.isArray(openAiContent)) {
      const textParts = openAiContent
        .map((part) => part?.text)
        .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
      if (textParts.length) modelContent = textParts.join('\n');
    }

    if (!modelContent) {
      const parts = payload.candidates?.[0]?.content?.parts ?? [];
      const textParts = parts
        .map((part) => part?.text)
        .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));

      if (textParts.length) {
        modelContent = textParts.join('\n');
      } else {
        const functionArgs = parts.find((part) => part?.functionCall?.args)?.functionCall?.args;
        if (functionArgs != null) modelContent = JSON.stringify(functionArgs);
      }
    }

    let parsed: { summary?: unknown; changes?: unknown } | null = null;

    const openAiToolCall = payload.choices?.[0]?.message?.tool_calls?.find(
      (call) => call?.function?.name === 'apply_auto_layout' && call?.function?.arguments,
    );

    if (openAiToolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(openAiToolCall.function.arguments) as { summary?: unknown; changes?: unknown };
      } catch {
        console.error('KIE_AUTO_LAYOUT_INVALID_OPENAI_TOOL_ARGS', openAiToolCall.function.arguments.slice(0, 2000));
      }
    }

    const candidateParts = payload.candidates?.[0]?.content?.parts ?? [];
    const toolArgs = candidateParts.find(
      (part) => part?.functionCall?.name === 'apply_auto_layout' && part?.functionCall?.args != null,
    )?.functionCall?.args;

    if (!parsed && toolArgs && typeof toolArgs === 'object') {
      parsed = toolArgs as { summary?: unknown; changes?: unknown };
    } else if (!parsed && modelContent) {
      parsed = extractJson(modelContent);
    }

    if (!parsed) {
      console.error('KIE_AUTO_LAYOUT_UNRECOGNIZED_RESPONSE', raw.slice(0, 3000));
      const topLevelKeys = payload && typeof payload === 'object' ? Object.keys(payload).join(', ') : 'none';
      const choiceMessageKeys = payload.choices?.[0]?.message
        ? Object.keys(payload.choices[0].message ?? {}).join('+')
        : 'none';
      const partKeys = candidateParts.map((part) => Object.keys(part ?? {}).join('+')).join(', ');
      throw new Error(
        `A Kie respondeu sem texto nem function call reconhecível. Estrutura: [${topLevelKeys}] · message: [${choiceMessageKeys}] · parts: [${partKeys || 'none'}]`,
      );
    }

    const changes = sanitizeAutoLayoutChanges(parsed.changes);

    const usage = payload.usage
      ? payload.usage
      : payload.usageMetadata
        ? {
            prompt_tokens: payload.usageMetadata.promptTokenCount,
            completion_tokens: payload.usageMetadata.candidatesTokenCount,
            total_tokens: payload.usageMetadata.totalTokenCount,
          }
        : null;

    return Response.json({
      summary: typeof parsed.summary === 'string'
        ? parsed.summary.trim().slice(0, 400)
        : 'Sugestão de Auto Layout pronta.',
      changes,
      usage,
      meta: {
        model: payload.modelVersion ?? null,
        creditsConsumed: payload.credits_consumed ?? null,
        backendVersion: AUTO_LAYOUT_BACKEND_VERSION,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Falha ao gerar Auto Layout.', backendVersion: AUTO_LAYOUT_BACKEND_VERSION },
      { status: 500 },
    );
  }
}


export default {
  async fetch(request: Request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    if (request.method !== 'POST') {
      return Response.json({ error: 'Método não permitido.', backendVersion: AUTO_LAYOUT_BACKEND_VERSION }, { status: 405 });
    }
    const response = await handleAutoLayout(request);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  },
};
