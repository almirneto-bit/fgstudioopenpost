'use client';

import { useEffect, useRef, useState } from 'react';
import SmPostCanvas, { type ExportProgress, type SmPostCanvasHandle } from './SmPostCanvas';
import {
  SAFE_MARGIN,
  SM_POST_DEFAULTS,
  SM_POST_TEMPLATE_PRESETS,
  type SmPostFields,
  type SmPostTemplateId,
} from '@/lib/smPostTemplate';

type EditorTab = 'edit' | 'advanced';
type ExportFormat = 'png' | 'gif' | 'mp4';

export default function SmPostEditor() {
  const [fields, setFields] = useState<SmPostFields>(SM_POST_DEFAULTS);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>('edit');
  const canvasRef = useRef<SmPostCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportProgress, setExportProgress] = useState<number | null>(null);

  useEffect(
    () => () => {
      if (fields.imageUrl) URL.revokeObjectURL(fields.imageUrl);
    },
    [fields.imageUrl],
  );

  const set = <K extends keyof SmPostFields>(key: K, value: SmPostFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  const onTemplateChange = (templateId: SmPostTemplateId) => {
    setFields((current) => {
      const previousPreset = SM_POST_TEMPLATE_PRESETS[current.templateId];
      const nextPreset = SM_POST_TEMPLATE_PRESETS[templateId];
      const stillUsingPresetCopy =
        current.tag === previousPreset.tag &&
        current.headline === previousPreset.headline &&
        current.bodyText === previousPreset.bodyText;

      if (stillUsingPresetCopy) return { ...current, ...nextPreset, templateId };

      const next: SmPostFields = { ...current, templateId };
      if ((templateId === '7' || templateId === '8') && current.headlineFontSize === previousPreset.headlineFontSize) {
        next.headlineFontSize = 136;
      }
      if (templateId === '9' && current.bodyFontSize === previousPreset.bodyFontSize) next.bodyFontSize = 56;
      return next;
    });
  };

  const onMediaPick = (file: File | undefined) => {
    if (!file) return;
    const mediaType = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
    if (!mediaType) {
      setError('Formato não suportado. Envie uma imagem ou vídeo.');
      return;
    }
    if (fields.imageUrl) URL.revokeObjectURL(fields.imageUrl);
    const url = URL.createObjectURL(file);
    setFields((f) => ({
      ...f,
      imageUrl: url,
      mediaType,
      imageScale: 1,
      imageOffsetX: 0,
      imageOffsetY: 0,
    }));
    setExportFormat(mediaType === 'video' ? 'mp4' : 'png');
    setError('');
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const onExport = async () => {
    setExporting(true);
    setExportProgress(exportFormat === 'png' ? null : 0);
    const onProgress: ExportProgress = (progress) => setExportProgress(progress);
    const baseName = `post-${fields.templateId}`;
    try {
      if (!canvasRef.current) throw new Error('Canvas indisponível.');
      if (exportFormat === 'png') {
        const blob = await canvasRef.current.exportPng();
        if (!blob) throw new Error('Canvas indisponível.');
        downloadBlob(blob, `${baseName}.png`);
      } else if (exportFormat === 'gif') {
        const blob = await canvasRef.current.exportGif(onProgress);
        downloadBlob(blob, `${baseName}.gif`);
      } else {
        const blob = await canvasRef.current.exportMp4(onProgress);
        downloadBlob(blob, `${baseName}.mp4`);
      }
      setError('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Falha ao exportar.');
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const exportLabel = exporting
    ? exportProgress == null
      ? 'Gerando…'
      : `Gerando… ${Math.round(exportProgress * 100)}%`
    : exportFormat === 'png'
      ? 'Baixar PNG (1080×1440)'
      : exportFormat === 'gif'
        ? 'Baixar GIF (720×960)'
        : 'Baixar MP4 (1080×1440)';

  const isBase = fields.templateId === '1';
  const isHeadlineVariant = fields.templateId === '7' || fields.templateId === '8';
  const isCopyVariant = fields.templateId === '9';

  return (
    <div className="sm-post-app">
      <header className="sm-post-header">
        <h1>FG Post Studio <small>Editor de post · v04</small></h1>
        <div className="sm-post-export-actions">
          <select
            className="sm-post-export-select"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            disabled={exporting}
            aria-label="Formato de exportação"
          >
            <option value="png">PNG</option>
            {fields.mediaType === 'video' && <option value="gif">GIF</option>}
            {fields.mediaType === 'video' && <option value="mp4">MP4</option>}
          </select>
          <button type="button" className="sm-post-export-btn" onClick={onExport} disabled={exporting}>
            {exportLabel}
          </button>
        </div>
      </header>

      <section className="sm-post-fields">
        <div className="sm-post-tabs" role="tablist" aria-label="Seções do editor">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'edit'}
            className={activeTab === 'edit' ? 'is-active' : ''}
            onClick={() => setActiveTab('edit')}
          >
            Edição
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'advanced'}
            className={activeTab === 'advanced' ? 'is-active' : ''}
            onClick={() => setActiveTab('advanced')}
          >
            Avançado
          </button>
        </div>

        {activeTab === 'edit' ? (
          <>
            <div className="sm-post-section-head"><span>Conteúdo do post</span></div>

            <label className="sm-post-field">
              <span>Modelo</span>
              <select value={fields.templateId} onChange={(e) => onTemplateChange(e.target.value as SmPostTemplateId)}>
                <option value="1">Instagram post 1</option>
                <option value="7">Instagram post 7</option>
                <option value="8">Instagram post 8</option>
                <option value="9">Instagram post 9</option>
              </select>
              <small>Modelos 7, 8 e 9 seguem os frames da page Test_SM-Post do Figma.</small>
            </label>

            <div className="sm-post-hairline" />

            <label className="sm-post-field">
              <span>Mídia</span>
              <button type="button" className="sm-post-upload" onClick={() => fileInputRef.current?.click()}>
                {fields.imageUrl ? 'Trocar mídia' : 'Enviar imagem ou vídeo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v"
                hidden
                onChange={(e) => onMediaPick(e.target.files?.[0])}
              />
              <small>
                {fields.mediaType === 'video'
                  ? 'Vídeo em loop na prévia. MP4 sai sem áudio; GIF usa 10 fps.'
                  : 'Aceita imagens e vídeos. Zoom e posição continuam independentes do modelo.'}
              </small>
            </label>

            {fields.imageUrl && (
              <div className="sm-post-control-group">
                <label className="sm-post-field sm-post-range-field">
                  <span>Zoom da mídia <strong>{Math.round(fields.imageScale * 100)}%</strong></span>
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

            <div className="sm-post-hairline" />

            <label className="sm-post-field">
              <span>Cor da logo Favela Gaming</span>
              <select value={fields.logoFgColor} onChange={(e) => set('logoFgColor', e.target.value as SmPostFields['logoFgColor'])}>
                <option value="white">Branco</option>
                <option value="black">Preto</option>
                <option value="orange">Laranja</option>
              </select>
              <small>Altera apenas a logo principal do Favela Gaming.</small>
            </label>

            {(isBase || isCopyVariant) && (
              <>
                <div className="sm-post-hairline" />
                <label className="sm-post-field">
                  <span>{isCopyVariant ? 'Perfil / @' : 'Tag'}</span>
                  <input type="text" value={fields.tag} maxLength={isCopyVariant ? 40 : 30} onChange={(e) => set('tag', e.target.value)} />
                  <span className="sm-post-inline-check">
                    <input type="checkbox" checked={fields.tagUppercase} onChange={(e) => set('tagUppercase', e.target.checked)} />
                    Exibir em CAPSLOCK
                  </span>
                </label>
              </>
            )}

            {(isBase || isHeadlineVariant) && (
              <>
                <div className="sm-post-hairline" />
                <label className="sm-post-field">
                  <span>Headline</span>
                  <textarea rows={4} value={fields.headline} maxLength={180} onChange={(e) => set('headline', e.target.value)} placeholder="Use Enter para controlar as quebras de linha" />
                  <span className="sm-post-inline-check">
                    <input type="checkbox" checked={fields.headlineUppercase} onChange={(e) => set('headlineUppercase', e.target.checked)} />
                    Exibir em CAPSLOCK
                  </span>
                  <small>Use Enter para criar uma quebra de linha manual.</small>
                </label>
                <label className="sm-post-field sm-post-range-field">
                  <span>Tamanho da headline <strong>{fields.headlineFontSize}px</strong></span>
                  <input
                    type="range"
                    min={isHeadlineVariant ? 72 : 48}
                    max={isHeadlineVariant ? 160 : 140}
                    step="1"
                    value={fields.headlineFontSize}
                    onChange={(e) => set('headlineFontSize', Number(e.target.value))}
                  />
                </label>
              </>
            )}

            {(isBase || isCopyVariant) && (
              <>
                <div className="sm-post-hairline" />
                <label className="sm-post-field">
                  <span>{isCopyVariant ? 'Texto principal' : 'Texto (body)'}</span>
                  <textarea rows={5} value={fields.bodyText} maxLength={320} onChange={(e) => set('bodyText', e.target.value)} placeholder="Use Enter para controlar as quebras de linha" />
                  <span className="sm-post-inline-check">
                    <input type="checkbox" checked={fields.bodyUppercase} onChange={(e) => set('bodyUppercase', e.target.checked)} />
                    Exibir em CAPSLOCK
                  </span>
                  <small>Use Enter para criar uma quebra de linha manual.</small>
                </label>
                <label className="sm-post-field sm-post-range-field">
                  <span>Tamanho do texto <strong>{fields.bodyFontSize}px</strong></span>
                  <input
                    type="range"
                    min={isCopyVariant ? 28 : 14}
                    max={isCopyVariant ? 80 : 48}
                    step="1"
                    value={fields.bodyFontSize}
                    onChange={(e) => set('bodyFontSize', Number(e.target.value))}
                  />
                </label>
              </>
            )}

            <div className="sm-post-hairline" />

            <div className="sm-post-disclosure">
              <label className="sm-post-toggle-field">
                <span>
                  <strong>Noise</strong>
                  <small>Adiciona textura à arte final.</small>
                </span>
                <input type="checkbox" checked={fields.noiseEnabled} onChange={(e) => set('noiseEnabled', e.target.checked)} />
              </label>
              {fields.noiseEnabled && (
                <div className="sm-post-disclosure-panel">
                  <label className="sm-post-field sm-post-range-field">
                    <span>Intensidade <strong>{fields.noiseIntensity}%</strong></span>
                    <input type="range" min="0" max="100" step="1" value={fields.noiseIntensity} onChange={(e) => set('noiseIntensity', Number(e.target.value))} />
                  </label>
                  <label className="sm-post-field sm-post-range-field">
                    <span>Tamanho do grão <strong>{fields.noiseSize}px</strong></span>
                    <input type="range" min="1" max="12" step="1" value={fields.noiseSize} onChange={(e) => set('noiseSize', Number(e.target.value))} />
                  </label>
                </div>
              )}
            </div>

            <div className="sm-post-hairline" />

            <label className="sm-post-toggle-field">
              <span>
                <strong>Margem de segurança</strong>
                <small>Exibe guias de {SAFE_MARGIN}px apenas na prévia.</small>
              </span>
              <input type="checkbox" checked={showSafeArea} onChange={(e) => setShowSafeArea(e.target.checked)} />
            </label>
          </>
        ) : (
          <>
            <div className="sm-post-section-head"><span>Ajustes avançados</span></div>
            {isBase ? (
              <>
                <p className="sm-post-hint sm-post-tab-intro">Controles finos de posicionamento e espaçamento do conteúdo.</p>
                <label className="sm-post-field sm-post-range-field">
                  <span>Espaço Tag → Headline <strong>{fields.tagHeadlineOffset > 0 ? '+' : ''}{fields.tagHeadlineOffset}px</strong></span>
                  <input type="range" min="-120" max="160" step="2" value={fields.tagHeadlineOffset} onChange={(e) => set('tagHeadlineOffset', Number(e.target.value))} />
                </label>
                <div className="sm-post-hairline" />
                <label className="sm-post-field sm-post-range-field">
                  <span>Espaço Headline → Body <strong>{fields.headlineBodyOffset > 0 ? '+' : ''}{fields.headlineBodyOffset}px</strong></span>
                  <input type="range" min="-160" max="160" step="2" value={fields.headlineBodyOffset} onChange={(e) => set('headlineBodyOffset', Number(e.target.value))} />
                </label>
              </>
            ) : (
              <p className="sm-post-hint sm-post-tab-intro">
                Os modelos {fields.templateId} preservam o posicionamento estrutural do Figma. Para ajustar a mídia, use Zoom e Posição na aba Edição.
              </p>
            )}
          </>
        )}

        {error && <p role="alert" className="sm-post-error">{error}</p>}
        <p className="sm-post-hint">As guias de margem nunca são incluídas no arquivo final exportado.</p>
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
