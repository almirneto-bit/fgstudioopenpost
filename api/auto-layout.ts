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
    'Sua resposta deve ser APENAS JSON, sem markdown, neste formato:',
    '{"summary":"explicação curta em português","changes":[{"property":"headlineFontSize","value":100,"reason":"motivo curto"}]}',
    'Se não houver mudança útil, use changes: [].',
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
      || 'https://api.kie.ai/gemini-3-8-flash-openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content }],
        stream: false,
        reasoning_effort: 'low',
      }),
    },
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'KIE_API_KEY não configurada no servidor.' },
      { status: 503 },
    );
  }

  let body: AutoLayoutRequest;
  try {
    body = await request.json() as AutoLayoutRequest;
  } catch {
    return Response.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  if (!body.state || typeof body.state !== 'object') {
    return Response.json({ error: 'Estado do layout ausente.' }, { status: 400 });
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
        { error: `Kie respondeu com status ${response.status}.`, detail: raw.slice(0, 500) },
        { status: response.status },
      );
    }

    const payload = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('A Kie não retornou conteúdo.');

    const parsed = extractJson(content);
    const changes = sanitizeAutoLayoutChanges(parsed.changes);
    return Response.json({
      summary: typeof parsed.summary === 'string'
        ? parsed.summary.trim().slice(0, 400)
        : 'Sugestão de Auto Layout pronta.',
      changes,
      usage: payload.usage ?? null,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Falha ao gerar Auto Layout.' },
      { status: 500 },
    );
  }
}
