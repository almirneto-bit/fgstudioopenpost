'use client';

import { useRef, useState } from 'react';
import SmPostCanvas, { type SmPostCanvasHandle } from './SmPostCanvas';
import { SM_POST_DEFAULTS, type SmPostFields } from '@/lib/smPostTemplate';

export default function SmPostEditor() {
  const [fields, setFields] = useState<SmPostFields>(SM_POST_DEFAULTS);
  const canvasRef = useRef<SmPostCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);

  const set = <K extends keyof SmPostFields>(key: K, value: SmPostFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  const onImagePick = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    set('imageUrl', url);
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const blob = await canvasRef.current?.exportPng();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'post.png';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="sm-post-app">
      <section className="card sm-post-fields card-scroll">
        <div className="section-head">
          <span>Conteúdo do post</span>
        </div>

        <label className="sm-post-field">
          <span>Imagem</span>
          <button
            type="button"
            className="sm-post-upload"
            onClick={() => fileInputRef.current?.click()}
          >
            {fields.imageUrl ? 'Trocar imagem' : 'Enviar imagem'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onImagePick(e.target.files?.[0])}
          />
        </label>

        <div className="hairline" />

        <label className="sm-post-field">
          <span>Tag</span>
          <input
            type="text"
            value={fields.tag}
            maxLength={30}
            onChange={(e) => set('tag', e.target.value)}
          />
        </label>

        <div className="hairline" />

        <label className="sm-post-field">
          <span>Headline</span>
          <textarea
            rows={3}
            value={fields.headline}
            maxLength={120}
            onChange={(e) => set('headline', e.target.value)}
          />
        </label>

        <div className="hairline" />

        <label className="sm-post-field">
          <span>Texto (body)</span>
          <textarea
            rows={4}
            value={fields.bodyText}
            maxLength={220}
            onChange={(e) => set('bodyText', e.target.value)}
          />
        </label>

        <div className="hairline" />

        <p className="sm-post-hint">
          Logo e sombra são fixos e não podem ser editados aqui.
        </p>
      </section>

      <main className="stage-col sm-post-stage">
        <div className="sm-post-canvas-wrap">
          <SmPostCanvas ref={canvasRef} fields={fields} />
        </div>
      </main>

      <section className="card right sm-post-export">
        <div className="section-head">
          <span>Exportar</span>
        </div>
        <button type="button" className="sm-post-export-btn" onClick={onExport} disabled={exporting}>
          {exporting ? 'Gerando…' : 'Baixar PNG (1080×1440)'}
        </button>
      </section>
    </div>
  );
}
