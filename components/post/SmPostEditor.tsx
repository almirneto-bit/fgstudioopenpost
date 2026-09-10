'use client';

import { useEffect, useRef, useState } from 'react';
import SmPostCanvas, { type SmPostCanvasHandle } from './SmPostCanvas';
import { SAFE_MARGIN, SM_POST_DEFAULTS, type SmPostFields } from '@/lib/smPostTemplate';

export default function SmPostEditor() {
  const [fields, setFields] = useState<SmPostFields>(SM_POST_DEFAULTS);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const canvasRef = useRef<SmPostCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(
    () => () => {
      if (fields.imageUrl) URL.revokeObjectURL(fields.imageUrl);
    },
    [fields.imageUrl],
  );

  const set = <K extends keyof SmPostFields>(key: K, value: SmPostFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  const onImagePick = (file: File | undefined) => {
    if (!file) return;
    if (fields.imageUrl) URL.revokeObjectURL(fields.imageUrl);
    const url = URL.createObjectURL(file);
    setFields((f) => ({ ...f, imageUrl: url, imageScale: 1, imageOffsetX: 0, imageOffsetY: 0 }));
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const blob = await canvasRef.current?.exportPng();
      if (!blob) throw new Error('Canvas indisponível.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'post.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Falha ao exportar.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="sm-post-app">
      <header className="sm-post-header">
        <h1>FG Post Studio <small>Editor de post · v02</small></h1>
        <button type="button" className="sm-post-export-btn" onClick={onExport} disabled={exporting}>
          {exporting ? 'Gerando…' : 'Baixar PNG (1080×1440)'}
        </button>
      </header>

      <section className="sm-post-fields">
        <div className="sm-post-section-head"><span>Conteúdo do post</span></div>

        <label className="sm-post-field">
          <span>Imagem</span>
          <button type="button" className="sm-post-upload" onClick={() => fileInputRef.current?.click()}>
            {fields.imageUrl ? 'Trocar imagem' : 'Enviar imagem'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => onImagePick(e.target.files?.[0])} />
        </label>

        {fields.imageUrl && (
          <div className="sm-post-control-group">
            <label className="sm-post-field sm-post-range-field">
              <span>Zoom da imagem <strong>{Math.round(fields.imageScale * 100)}%</strong></span>
              <input type="range" min="1" max="2.5" step="0.01" value={fields.imageScale} onChange={(e) => set('imageScale', Number(e.target.value))} />
            </label>
            <div className="sm-post-two-col">
              <label className="sm-post-field">
                <span>Posição horizontal</span>
                <input type="number" min="-800" max="800" step="5" value={fields.imageOffsetX} onChange={(e) => set('imageOffsetX', Number(e.target.value))} />
              </label>
              <label className="sm-post-field">
                <span>Posição vertical</span>
                <input type="number" min="-800" max="800" step="5" value={fields.imageOffsetY} onChange={(e) => set('imageOffsetY', Number(e.target.value))} />
              </label>
            </div>
          </div>
        )}

        <label className="sm-post-field sm-post-range-field">
          <span>Noise <strong>{fields.noiseIntensity}%</strong></span>
          <input type="range" min="0" max="100" step="1" value={fields.noiseIntensity} onChange={(e) => set('noiseIntensity', Number(e.target.value))} />
          <small>Aplicado na arte e incluído no PNG exportado.</small>
        </label>

        <div className="sm-post-hairline" />

        <label className="sm-post-field">
          <span>Tag</span>
          <input type="text" value={fields.tag} maxLength={30} onChange={(e) => set('tag', e.target.value)} />
        </label>

        <label className="sm-post-field sm-post-range-field">
          <span>Espaço Tag → Headline <strong>{fields.tagHeadlineOffset > 0 ? '+' : ''}{fields.tagHeadlineOffset}px</strong></span>
          <input type="range" min="-120" max="160" step="2" value={fields.tagHeadlineOffset} onChange={(e) => set('tagHeadlineOffset', Number(e.target.value))} />
        </label>

        <div className="sm-post-hairline" />

        <label className="sm-post-field">
          <span>Headline</span>
          <textarea rows={4} value={fields.headline} maxLength={180} onChange={(e) => set('headline', e.target.value)} placeholder="Use Enter para controlar as quebras de linha" />
          <small>Use Enter para criar uma quebra de linha manual.</small>
        </label>

        <label className="sm-post-field sm-post-range-field">
          <span>Tamanho da headline <strong>{fields.headlineFontSize}px</strong></span>
          <input type="range" min="48" max="140" step="1" value={fields.headlineFontSize} onChange={(e) => set('headlineFontSize', Number(e.target.value))} />
        </label>

        <label className="sm-post-field sm-post-range-field">
          <span>Espaço Headline → Body <strong>{fields.headlineBodyOffset > 0 ? '+' : ''}{fields.headlineBodyOffset}px</strong></span>
          <input type="range" min="-160" max="160" step="2" value={fields.headlineBodyOffset} onChange={(e) => set('headlineBodyOffset', Number(e.target.value))} />
        </label>

        <div className="sm-post-hairline" />

        <label className="sm-post-field">
          <span>Texto (body)</span>
          <textarea rows={5} value={fields.bodyText} maxLength={320} onChange={(e) => set('bodyText', e.target.value)} placeholder="Use Enter para controlar as quebras de linha" />
          <small>Use Enter para criar uma quebra de linha manual.</small>
        </label>

        <label className="sm-post-field sm-post-range-field">
          <span>Tamanho do body <strong>{fields.bodyFontSize}px</strong></span>
          <input type="range" min="14" max="48" step="1" value={fields.bodyFontSize} onChange={(e) => set('bodyFontSize', Number(e.target.value))} />
        </label>

        <div className="sm-post-hairline" />

        <label className="sm-post-toggle-field">
          <span>
            <strong>Margem de segurança</strong>
            <small>Exibe guias de {SAFE_MARGIN}px apenas na prévia.</small>
          </span>
          <input type="checkbox" checked={showSafeArea} onChange={(e) => setShowSafeArea(e.target.checked)} />
        </label>

        {error && <p role="alert" className="sm-post-error">{error}</p>}
        <p className="sm-post-hint">As guias de margem nunca são incluídas na imagem final exportada.</p>
      </section>

      <main className="sm-post-stage">
        <div className="sm-post-canvas-wrap">
          <SmPostCanvas ref={canvasRef} fields={fields} onError={setError} />
          {showSafeArea && (
            <div
              className="sm-post-safe-area"
              style={{
                top: `${(SAFE_MARGIN / 1440) * 100}%`,
                right: `${(SAFE_MARGIN / 1080) * 100}%`,
                bottom: `${(SAFE_MARGIN / 1440) * 100}%`,
                left: `${(SAFE_MARGIN / 1080) * 100}%`,
              }}
              aria-hidden="true"
            />
          )}
        </div>
      </main>
    </div>
  );
}
