'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import JSZip from 'jszip';
import SmPostCanvas, { renderPostBlob, type SmPostCanvasHandle } from './SmPostCanvas';
import {
  SAFE_MARGIN,
  SPECIAL_LAYOUT_COLORS,
  SM_POST_LAYOUT_OPTIONS,
  SM_POST_LAYOUTS,
  createDefaultFields,
  type FgLogoColor,
  type SmPostFields,
  type SmPostLayoutId,
  type SmPostMediaType,
} from '@/lib/smPostTemplate';
import {
  ACTIVE_PROJECT_KEY,
  createProject,
  createSlide,
  getProject,
  listProjects,
  saveProject,
  type SmPostProject,
} from '@/lib/smPostStorage';

type EditorTab = 'edit' | 'advanced';
type ExportFormat = 'png' | 'gif' | 'mp4';
type VideoPreviewState = { duration: number; currentTime: number; isPlaying: boolean };

const EMPTY_VIDEO_PREVIEW: VideoPreviewState = { duration: 0, currentTime: 0, isPlaying: false };

function formatVideoTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remaining = Math.floor(safe % 60);
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function inferMediaType(url: string | null, current?: SmPostMediaType): SmPostMediaType {
  if (current) return current;
  if (!url) return null;
  if (/^data:video\//i.test(url) || /^blob:/i.test(url)) return 'video';
  return 'image';
}

function normalizeProject(project: SmPostProject): SmPostProject {
  const slides = project.slides.length ? project.slides : [createSlide()];
  const normalizedSlides = slides.map((slide) => {
    const layoutId = slide.fields.layoutId && SM_POST_LAYOUTS[slide.fields.layoutId]
      ? slide.fields.layoutId
      : 'classic';
    const defaults = createDefaultFields(layoutId);
    return {
      ...slide,
      fields: {
        ...defaults,
        ...slide.fields,
        layoutId,
        mediaType: inferMediaType(slide.fields.imageUrl ?? null, slide.fields.mediaType),
        headlineFontSize: Math.min(250, Math.max(8, Number(slide.fields.headlineFontSize ?? defaults.headlineFontSize))),
        bodyFontSize: Math.min(250, Math.max(8, Number(slide.fields.bodyFontSize ?? defaults.bodyFontSize))),
        headlineLineHeight: Math.min(2, Math.max(0.5, Number(slide.fields.headlineLineHeight ?? defaults.headlineLineHeight))),
        bodyLineHeight: Math.min(2, Math.max(0.5, Number(slide.fields.bodyLineHeight ?? defaults.bodyLineHeight))),
        videoTrimStart: Math.max(0, Number(slide.fields.videoTrimStart ?? 0)),
        videoTrimEnd: slide.fields.videoTrimEnd == null ? null : Math.max(0, Number(slide.fields.videoTrimEnd)),
      },
    };
  });
  const activeSlideId = normalizedSlides.some((slide) => slide.id === project.activeSlideId)
    ? project.activeSlideId
    : normalizedSlides[0].id;
  return { ...project, slides: normalizedSlides, activeSlideId };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'carrossel';
}

export default function SmPostEditor() {
  const [project, setProject] = useState<SmPostProject | null>(null);
  const [history, setHistory] = useState<SmPostProject[]>([]);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>('edit');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [exportProgress, setExportProgress] = useState(0);
  const [videoPreview, setVideoPreview] = useState<VideoPreviewState>(EMPTY_VIDEO_PREVIEW);
  const [saveState, setSaveState] = useState<'loading' | 'saved' | 'saving' | 'error'>('loading');
  const canvasRef = useRef<SmPostCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const recent = await listProjects();
        const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY);
        const active = activeId ? await getProject(activeId) : null;
        const nextProject = normalizeProject(active ?? recent[0] ?? createProject());
        if (!cancelled) {
          setProject(nextProject);
          setHistory(recent.map(normalizeProject));
          localStorage.setItem(ACTIVE_PROJECT_KEY, nextProject.id);
          setSaveState('saved');
        }
      } catch {
        if (!cancelled) {
          setProject(createProject());
          setSaveState('error');
          setError('O histórico local não pôde ser carregado, mas você ainda pode usar o editor.');
        }
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!project || saveState === 'loading') return;
    setSaveState('saving');
    const timeout = window.setTimeout(async () => {
      try {
        const recent = await saveProject(project);
        localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
        setHistory(recent.map(normalizeProject));
        setSaveState('saved');
      } catch {
        setSaveState('error');
        setError('Não foi possível salvar esta criação no navegador.');
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [project]);

  const activeSlide = useMemo(
    () => project?.slides.find((slide) => slide.id === project.activeSlideId) ?? project?.slides[0],
    [project],
  );
  const activeIndex = project && activeSlide
    ? project.slides.findIndex((slide) => slide.id === activeSlide.id)
    : 0;
  const fields = activeSlide?.fields;
  const layout = fields ? SM_POST_LAYOUTS[fields.layoutId] : SM_POST_LAYOUTS.classic;

  useEffect(() => {
    if (fields?.mediaType !== 'video' && exportFormat !== 'png') setExportFormat('png');
  }, [fields?.mediaType, exportFormat]);

  useEffect(() => {
    setVideoPreview(EMPTY_VIDEO_PREVIEW);
  }, [activeSlide?.id, fields?.imageUrl, fields?.mediaType]);

  const updateProject = (recipe: (current: SmPostProject) => SmPostProject) => {
    setProject((current) => current ? { ...recipe(current), updatedAt: Date.now() } : current);
  };

  const setField = <K extends keyof SmPostFields>(key: K, value: SmPostFields[K]) => {
    if (!activeSlide) return;
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => slide.id === activeSlide.id
        ? { ...slide, fields: { ...slide.fields, [key]: value } }
        : slide),
    }));
  };

  const onMediaPick = (file: File | undefined) => {
    if (!file || !activeSlide) return;
    const mediaType: SmPostMediaType = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
    if (!mediaType) {
      setError('Envie uma imagem ou um vídeo MP4/WebM.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      updateProject((current) => ({
        ...current,
        slides: current.slides.map((slide) => slide.id === activeSlide.id
          ? {
              ...slide,
              fields: {
                ...slide.fields,
                imageUrl: reader.result as string,
                mediaType,
                videoTrimStart: 0,
                videoTrimEnd: null,
                imageScale: 1,
                imageOffsetX: 0,
                imageOffsetY: 0,
              },
            }
          : slide),
      }));
      setError('');
    };
    reader.onerror = () => setError('Não foi possível ler a mídia selecionada.');
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addSlide = (layoutId: SmPostLayoutId) => {
    const slide = createSlide(layoutId);
    updateProject((current) => ({
      ...current,
      slides: [...current.slides, slide],
      activeSlideId: slide.id,
    }));
    setActiveTab('edit');
    setExportFormat('png');
  };

  const changeLayout = (layoutId: SmPostLayoutId) => {
    if (!activeSlide) return;
    const defaults = createDefaultFields(layoutId);
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => slide.id === activeSlide.id
        ? {
            ...slide,
            fields: {
              ...slide.fields,
              layoutId,
              headlineFontSize: defaults.headlineFontSize,
              headlineLineHeight: defaults.headlineLineHeight,
              bodyFontSize: defaults.bodyFontSize,
              bodyLineHeight: defaults.bodyLineHeight,
              layoutBackgroundColor: defaults.layoutBackgroundColor,
              tagHeadlineOffset: 0,
              headlineBodyOffset: 0,
            },
          }
        : slide),
    }));
  };

  const duplicateSlide = () => {
    if (!activeSlide) return;
    const copy = createSlide(activeSlide.fields.layoutId);
    copy.fields = { ...activeSlide.fields };
    updateProject((current) => {
      const index = current.slides.findIndex((slide) => slide.id === activeSlide.id);
      const slides = [...current.slides];
      slides.splice(index + 1, 0, copy);
      return { ...current, slides, activeSlideId: copy.id };
    });
  };

  const removeSlide = () => {
    if (!project || !activeSlide || project.slides.length === 1) return;
    updateProject((current) => {
      const index = current.slides.findIndex((slide) => slide.id === activeSlide.id);
      const slides = current.slides.filter((slide) => slide.id !== activeSlide.id);
      return {
        ...current,
        slides,
        activeSlideId: slides[Math.min(index, slides.length - 1)].id,
      };
    });
  };

  const moveSlide = (direction: -1 | 1) => {
    if (!project || !activeSlide) return;
    const index = project.slides.findIndex((slide) => slide.id === activeSlide.id);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= project.slides.length) return;
    updateProject((current) => {
      const slides = [...current.slides];
      [slides[index], slides[nextIndex]] = [slides[nextIndex], slides[index]];
      return { ...current, slides };
    });
  };

  const newProject = async () => {
    if (!project) return;
    try {
      const recent = await saveProject(project);
      const next = createProject();
      setHistory(recent.map(normalizeProject));
      setProject(next);
      localStorage.setItem(ACTIVE_PROJECT_KEY, next.id);
      setActiveTab('edit');
      setExportFormat('png');
      setError('');
    } catch {
      setError('Não foi possível salvar a criação atual antes de iniciar outra.');
    }
  };

  const openProject = async (projectId: string) => {
    if (!project || projectId === project.id) return;
    try {
      await saveProject(project);
      const saved = await getProject(projectId);
      if (!saved) return;
      const next = normalizeProject(saved);
      setProject(next);
      localStorage.setItem(ACTIVE_PROJECT_KEY, next.id);
      setExportFormat('png');
      setError('');
    } catch {
      setError('Não foi possível abrir essa criação.');
    }
  };

  const exportCurrent = async () => {
    if (!activeSlide) return;
    setExporting(true);
    setExportProgress(0);
    try {
      let blob: Blob | null | undefined;
      if (exportFormat === 'gif') {
        blob = await canvasRef.current?.exportGif(setExportProgress);
      } else if (exportFormat === 'mp4') {
        blob = await canvasRef.current?.exportMp4(setExportProgress);
      } else {
        blob = await canvasRef.current?.exportPng();
      }
      if (!blob) throw new Error('Canvas indisponível.');
      downloadBlob(blob, `${safeFilename(project?.name ?? 'post')}-${activeIndex + 1}.${exportFormat}`);
      setError('');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Falha ao exportar.');
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const exportCarousel = async () => {
    if (!project) return;
    setExporting(true);
    try {
      const baseName = safeFilename(project.name);
      const archive = new JSZip();
      for (let index = 0; index < project.slides.length; index += 1) {
        const blob = await renderPostBlob(project.slides[index].fields);
        archive.file(`${baseName}-${String(index + 1).padStart(2, '0')}.png`, blob);
      }
      const zip = await archive.generateAsync({ type: 'blob' });
      downloadBlob(zip, `${baseName}.zip`);
      setError('');
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Falha ao exportar o carrossel.');
    } finally {
      setExporting(false);
    }
  };

  if (!project || !fields) {
    return <div className="sm-post-loading">Carregando o editor…</div>;
  }

  const isPost9 = layout.kind === 'post9';
  const showTag = Boolean(layout.tag) || isPost9;
  const showHeadline = !isPost9;
  const showBody = layout.kind === 'standard' || isPost9;
  const formatLabel = exportFormat.toUpperCase();
  const videoDuration = videoPreview.duration;
  const trimStart = Math.min(fields.videoTrimStart, videoDuration || fields.videoTrimStart);
  const trimEnd = videoDuration > 0
    ? Math.min(fields.videoTrimEnd ?? videoDuration, videoDuration)
    : (fields.videoTrimEnd ?? 0);
  const trimStartPercent = videoDuration > 0 ? (trimStart / videoDuration) * 100 : 0;
  const trimEndPercent = videoDuration > 0 ? (trimEnd / videoDuration) * 100 : 100;
  const timelineStyle = {
    '--trim-start': `${trimStartPercent}%`,
    '--trim-end': `${trimEndPercent}%`,
  } as CSSProperties;

  const updateTrimStart = (value: number) => {
    if (!videoDuration) return;
    const next = Math.max(0, Math.min(value, Math.max(0, trimEnd - 0.05)));
    setField('videoTrimStart', next);
    canvasRef.current?.seekVideo(next);
  };

  const updateTrimEnd = (value: number) => {
    if (!videoDuration) return;
    const next = Math.min(videoDuration, Math.max(value, Math.min(videoDuration, trimStart + 0.05)));
    setField('videoTrimEnd', next);
    if (videoPreview.currentTime > next) canvasRef.current?.seekVideo(next);
  };

  return (
    <div className="sm-post-app">
      <header className="sm-post-header">
        <h1>FG Post Studio <small>Editor de carrossel · v06</small></h1>
        <div className="sm-post-header-actions">
          <select
            className="sm-post-secondary-btn"
            value={exportFormat}
            onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
            aria-label="Formato da lâmina"
            disabled={exporting}
          >
            <option value="png">PNG</option>
            {fields.mediaType === 'video' && <option value="gif">GIF</option>}
            {fields.mediaType === 'video' && <option value="mp4">MP4</option>}
          </select>
          <button type="button" className="sm-post-secondary-btn" onClick={exportCurrent} disabled={exporting}>
            {exporting && exportProgress > 0
              ? `Gerando ${formatLabel} ${Math.round(exportProgress * 100)}%`
              : `Baixar lâmina ${activeIndex + 1} · ${formatLabel}`}
          </button>
          <button type="button" className="sm-post-export-btn" onClick={exportCarousel} disabled={exporting}>
            {exporting && exportProgress === 0 ? 'Gerando…' : `Baixar carrossel (${project.slides.length})`}
          </button>
        </div>
      </header>

      <aside className="sm-post-layouts" aria-label="Lâminas e layouts">
        <div className="sm-post-rail-head">
          <div>
            <strong>Criação</strong>
            <small>{saveState === 'saving' ? 'Salvando…' : saveState === 'saved' ? 'Salvo neste navegador' : 'Salvamento indisponível'}</small>
          </div>
          <button type="button" className="sm-post-icon-btn" onClick={newProject}>Nova</button>
        </div>
        <input
          className="sm-post-project-name"
          value={project.name}
          aria-label="Nome da criação"
          onChange={(event) => updateProject((current) => ({ ...current, name: event.target.value }))}
        />

        <div className="sm-post-rail-section">
          <div className="sm-post-section-head"><span>Lâminas</span><small>{project.slides.length}</small></div>
          <div className="sm-post-slide-list">
            {project.slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={slide.id === activeSlide.id ? 'sm-post-slide-item is-active' : 'sm-post-slide-item'}
                onClick={() => updateProject((current) => ({ ...current, activeSlideId: slide.id }))}
              >
                <span>{index + 1}</span>
                <span>{SM_POST_LAYOUTS[slide.fields.layoutId]?.shortName ?? 'Clássico'}</span>
              </button>
            ))}
          </div>
          <div className="sm-post-slide-actions">
            <button type="button" onClick={() => moveSlide(-1)} disabled={activeIndex === 0} aria-label="Mover lâmina para trás">↑</button>
            <button type="button" onClick={() => moveSlide(1)} disabled={activeIndex === project.slides.length - 1} aria-label="Mover lâmina para frente">↓</button>
            <button type="button" onClick={duplicateSlide}>Duplicar</button>
            <button type="button" onClick={removeSlide} disabled={project.slides.length === 1}>Excluir</button>
          </div>
        </div>

        <div className="sm-post-rail-section">
          <div className="sm-post-section-head"><span>Adicionar layout</span></div>
          <div className="sm-post-layout-grid">
            {SM_POST_LAYOUT_OPTIONS.map((option) => (
              <button key={option.id} type="button" className="sm-post-layout-card" onClick={() => addSlide(option.id)}>
                <span
                  className={`sm-post-layout-preview align-${option.headline.align} font-${option.headline.fontFamily.includes('Kanit') ? 'kanit' : 'vina'} kind-${option.kind}`}
                >
                  {option.tag && <i />}
                  <b>{option.kind === 'post9' ? '@FG' : 'ABC'}</b>
                  <em />
                </span>
                <span>{option.shortName}</span>
                <small>+ adicionar</small>
              </button>
            ))}
          </div>
        </div>

        <div className="sm-post-rail-section">
          <div className="sm-post-section-head"><span>Últimas criações</span><small>5</small></div>
          <div className="sm-post-history-list">
            {history.length === 0 && <p className="sm-post-hint">As criações salvas aparecerão aqui.</p>}
            {history.map((saved) => (
              <button
                key={saved.id}
                type="button"
                className={saved.id === project.id ? 'is-active' : ''}
                onClick={() => openProject(saved.id)}
              >
                <span>{saved.name}</span>
                <small>{saved.slides.length} {saved.slides.length === 1 ? 'lâmina' : 'lâminas'}</small>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="sm-post-fields">
        <div className="sm-post-tabs" role="tablist" aria-label="Seções do editor">
          <button type="button" role="tab" aria-selected={activeTab === 'edit'} className={activeTab === 'edit' ? 'is-active' : ''} onClick={() => setActiveTab('edit')}>Edição</button>
          <button type="button" role="tab" aria-selected={activeTab === 'advanced'} className={activeTab === 'advanced' ? 'is-active' : ''} onClick={() => setActiveTab('advanced')}>Avançado</button>
        </div>

        {activeTab === 'edit' ? (
          <>
            <div className="sm-post-section-head"><span>Conteúdo da lâmina {activeIndex + 1}</span></div>

            <label className="sm-post-field">
              <span>Layout</span>
              <select value={fields.layoutId} onChange={(event) => changeLayout(event.target.value as SmPostLayoutId)}>
                {SM_POST_LAYOUT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </label>

            <label className="sm-post-field">
              <span>Mídia</span>
              <button type="button" className="sm-post-upload" onClick={() => fileInputRef.current?.click()}>
                {fields.imageUrl ? `Trocar ${fields.mediaType === 'video' ? 'vídeo' : 'imagem'}` : 'Enviar imagem ou vídeo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                hidden
                onChange={(event) => onMediaPick(event.target.files?.[0])}
              />
              <small>Vídeos MP4/WebM podem ser exportados em GIF ou MP4.</small>
            </label>

            {fields.mediaType === 'video' && (
              <label className="sm-post-toggle-field">
                <span><strong>Manter áudio no MP4</strong><small>Inclui a faixa de áudio original quando o navegador oferecer captura compatível.</small></span>
                <input type="checkbox" checked={fields.keepVideoAudio} onChange={(event) => setField('keepVideoAudio', event.target.checked)} />
              </label>
            )}

            {fields.imageUrl && (
              <div className="sm-post-control-group">
                <label className="sm-post-field sm-post-range-field">
                  <span>Zoom da mídia <strong>{Math.round(fields.imageScale * 100)}%</strong></span>
                  <input type="range" min="1" max="2.5" step="0.01" value={fields.imageScale} onChange={(event) => setField('imageScale', Number(event.target.value))} />
                </label>
                <div className="sm-post-two-col">
                  <label className="sm-post-field"><span>Posição horizontal</span><input type="number" min="-800" max="800" step="5" value={fields.imageOffsetX} onChange={(event) => setField('imageOffsetX', Number(event.target.value))} /></label>
                  <label className="sm-post-field"><span>Posição vertical</span><input type="number" min="-800" max="800" step="5" value={fields.imageOffsetY} onChange={(event) => setField('imageOffsetY', Number(event.target.value))} /></label>
                </div>
              </div>
            )}

            <div className="sm-post-hairline" />

            <label className="sm-post-field">
              <span>Cor da logo Favela Gaming</span>
              <select value={fields.logoFgColor} onChange={(event) => setField('logoFgColor', event.target.value as FgLogoColor)}>
                <option value="white">Branco</option>
                <option value="black">Preto</option>
                <option value="orange">Laranja</option>
              </select>
            </label>

            {layout.kind !== 'standard' && (
              <>
                <div className="sm-post-hairline" />
                <div className="sm-post-two-col">
                  <label className="sm-post-field">
                    <span>Cor do layout</span>
                    <select
                      value={SPECIAL_LAYOUT_COLORS.some((option) => option.value === fields.layoutBackgroundColor) ? fields.layoutBackgroundColor : 'custom'}
                      onChange={(event) => {
                        if (event.target.value !== 'custom') setField('layoutBackgroundColor', event.target.value);
                      }}
                    >
                      {SPECIAL_LAYOUT_COLORS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      <option value="custom">Personalizada</option>
                    </select>
                  </label>
                  <label className="sm-post-field sm-post-color-field">
                    <span>Personalizada</span>
                    <input type="color" value={fields.layoutBackgroundColor} onChange={(event) => setField('layoutBackgroundColor', event.target.value)} />
                  </label>
                </div>
              </>
            )}

            {showTag && (
              <>
                <div className="sm-post-hairline" />
                <label className="sm-post-field">
                  <span>{isPost9 ? 'Handle' : 'Tag'}</span>
                  <input type="text" value={fields.tag} maxLength={40} onChange={(event) => setField('tag', event.target.value)} />
                </label>
                <label className="sm-post-toggle-field">
                  <span><strong>CAPSLOCK</strong><small>Forçar caixa alta neste texto.</small></span>
                  <input type="checkbox" checked={fields.tagUppercase} onChange={(event) => setField('tagUppercase', event.target.checked)} />
                </label>
              </>
            )}

            {showHeadline && (
              <>
                <div className="sm-post-hairline" />
                <label className="sm-post-field">
                  <span>Headline</span>
                  <textarea rows={4} value={fields.headline} onChange={(event) => setField('headline', event.target.value)} placeholder="Use Enter para controlar as quebras de linha" />
                  <small>Use Enter para criar uma quebra de linha manual.</small>
                </label>
                <div className="sm-post-text-edits">
                  <div className="sm-post-text-edits-title">Edições</div>
                  <label className="sm-post-toggle-field is-compact">
                    <span><strong>CAPSLOCK</strong><small>Forçar caixa alta na headline.</small></span>
                    <input type="checkbox" checked={fields.headlineUppercase} onChange={(event) => setField('headlineUppercase', event.target.checked)} />
                  </label>
                  <label className="sm-post-field sm-post-range-field is-compact">
                    <span>Tamanho <strong>{fields.headlineFontSize}px</strong></span>
                    <input type="range" min="8" max="250" step="1" value={fields.headlineFontSize} onChange={(event) => setField('headlineFontSize', Number(event.target.value))} />
                  </label>
                  <label className="sm-post-field sm-post-range-field is-compact">
                    <span>Entrelinha <strong>{fields.headlineLineHeight.toFixed(2)}×</strong></span>
                    <input type="range" min="0.5" max="2" step="0.05" value={fields.headlineLineHeight} onChange={(event) => setField('headlineLineHeight', Number(event.target.value))} />
                  </label>
                </div>
              </>
            )}

            {showBody && (
              <>
                <div className="sm-post-hairline" />
                <label className="sm-post-field">
                  <span>{isPost9 ? 'Texto principal' : 'Texto (body)'}</span>
                  <textarea rows={5} value={fields.bodyText} onChange={(event) => setField('bodyText', event.target.value)} placeholder="Use Enter para controlar as quebras de linha" />
                  <small>Use Enter para criar uma quebra de linha manual.</small>
                </label>
                <div className="sm-post-text-edits">
                  <div className="sm-post-text-edits-title">Edições</div>
                  <label className="sm-post-toggle-field is-compact">
                    <span><strong>CAPSLOCK</strong><small>Forçar caixa alta neste texto.</small></span>
                    <input type="checkbox" checked={fields.bodyUppercase} onChange={(event) => setField('bodyUppercase', event.target.checked)} />
                  </label>
                  <label className="sm-post-field sm-post-range-field is-compact">
                    <span>Tamanho <strong>{fields.bodyFontSize}px</strong></span>
                    <input type="range" min="8" max="250" step="1" value={fields.bodyFontSize} onChange={(event) => setField('bodyFontSize', Number(event.target.value))} />
                  </label>
                  <label className="sm-post-field sm-post-range-field is-compact">
                    <span>Entrelinha <strong>{fields.bodyLineHeight.toFixed(2)}×</strong></span>
                    <input type="range" min="0.5" max="2" step="0.05" value={fields.bodyLineHeight} onChange={(event) => setField('bodyLineHeight', Number(event.target.value))} />
                  </label>
                </div>
              </>
            )}

            <div className="sm-post-hairline" />

            <div className="sm-post-disclosure">
              <label className="sm-post-toggle-field">
                <span><strong>Camada de cor</strong><small>Cor aplicada sobre a mídia.</small></span>
                <input type="checkbox" checked={fields.colorOverlayEnabled} onChange={(event) => setField('colorOverlayEnabled', event.target.checked)} />
              </label>
              {fields.colorOverlayEnabled && (
                <div className="sm-post-disclosure-panel">
                  <label className="sm-post-field sm-post-color-field"><span>Cor</span><input type="color" value={fields.colorOverlay} onChange={(event) => setField('colorOverlay', event.target.value)} /></label>
                  <label className="sm-post-field sm-post-range-field"><span>Opacidade <strong>{fields.colorOverlayOpacity}%</strong></span><input type="range" min="0" max="100" step="1" value={fields.colorOverlayOpacity} onChange={(event) => setField('colorOverlayOpacity', Number(event.target.value))} /></label>
                </div>
              )}
            </div>

            <div className="sm-post-hairline" />

            <div className="sm-post-disclosure">
              <label className="sm-post-toggle-field">
                <span><strong>Noise</strong><small>Adiciona textura à arte final.</small></span>
                <input type="checkbox" checked={fields.noiseEnabled} onChange={(event) => setField('noiseEnabled', event.target.checked)} />
              </label>
              {fields.noiseEnabled && (
                <div className="sm-post-disclosure-panel">
                  <label className="sm-post-field sm-post-range-field"><span>Intensidade <strong>{fields.noiseIntensity}%</strong></span><input type="range" min="0" max="100" step="1" value={fields.noiseIntensity} onChange={(event) => setField('noiseIntensity', Number(event.target.value))} /></label>
                  <label className="sm-post-field sm-post-range-field"><span>Tamanho do grão <strong>{fields.noiseSize}px</strong></span><input type="range" min="1" max="12" step="1" value={fields.noiseSize} onChange={(event) => setField('noiseSize', Number(event.target.value))} /></label>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="sm-post-section-head"><span>Ajustes avançados</span></div>
            <p className="sm-post-hint sm-post-tab-intro">Controles finos da lâmina selecionada.</p>

            <label className="sm-post-toggle-field">
              <span><strong>Sombra inferior</strong><small>Gradiente escuro na base da área de mídia.</small></span>
              <input type="checkbox" checked={fields.bottomShadowEnabled} onChange={(event) => setField('bottomShadowEnabled', event.target.checked)} />
            </label>
            <div className="sm-post-hairline" />
            <label className="sm-post-toggle-field">
              <span><strong>Sombra superior</strong><small>Gradiente escuro no topo da área de mídia.</small></span>
              <input type="checkbox" checked={fields.topShadowEnabled} onChange={(event) => setField('topShadowEnabled', event.target.checked)} />
            </label>

            {layout.kind !== 'post9' && (
              <>
                <div className="sm-post-hairline" />
                <label className="sm-post-field sm-post-range-field">
                  <span>{layout.tag ? 'Espaço Tag → Headline' : 'Posição vertical da headline'} <strong>{fields.tagHeadlineOffset > 0 ? '+' : ''}{fields.tagHeadlineOffset}px</strong></span>
                  <input type="range" min="-180" max="180" step="2" value={fields.tagHeadlineOffset} onChange={(event) => setField('tagHeadlineOffset', Number(event.target.value))} />
                </label>
              </>
            )}

            {layout.kind === 'standard' && (
              <>
                <div className="sm-post-hairline" />
                <label className="sm-post-field sm-post-range-field">
                  <span>Espaço Headline → Body <strong>{fields.headlineBodyOffset > 0 ? '+' : ''}{fields.headlineBodyOffset}px</strong></span>
                  <input type="range" min="-180" max="180" step="2" value={fields.headlineBodyOffset} onChange={(event) => setField('headlineBodyOffset', Number(event.target.value))} />
                </label>
              </>
            )}

            <div className="sm-post-hairline" />
            <label className="sm-post-toggle-field">
              <span><strong>Margem de segurança</strong><small>Exibe guias de {SAFE_MARGIN}px somente na prévia.</small></span>
              <input type="checkbox" checked={showSafeArea} onChange={(event) => setShowSafeArea(event.target.checked)} />
            </label>
          </>
        )}

        {error && <p role="alert" className="sm-post-error">{error}</p>}
        <p className="sm-post-hint">
          O histórico mantém automaticamente as cinco criações mais recentes neste navegador.
          {project.slides.some((slide) => slide.fields.mediaType === 'video') && ' No ZIP do carrossel, vídeos usam o primeiro frame em PNG.'}
        </p>
      </section>

      <main className={fields.mediaType === 'video' ? 'sm-post-stage has-video' : 'sm-post-stage'}>
        <div className="sm-post-canvas-wrap">
          <SmPostCanvas
            ref={canvasRef}
            fields={fields}
            onError={setError}
            onVideoStateChange={setVideoPreview}
          />
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

        {fields.mediaType === 'video' && fields.imageUrl && (
          <div className="sm-post-video-timeline">
            <div className="sm-post-video-controls">
              <button
                type="button"
                className="sm-post-video-play"
                onClick={() => canvasRef.current?.togglePlayback()}
                disabled={!videoDuration}
                aria-label={videoPreview.isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'}
              >
                {videoPreview.isPlaying ? 'Pausar' : 'Play'}
              </button>
              <span>{formatVideoTime(videoPreview.currentTime)} / {formatVideoTime(videoDuration)}</span>
            </div>

            <label className="sm-post-video-seek">
              <span className="sr-only">Posição do vídeo</span>
              <input
                type="range"
                min="0"
                max={videoDuration || 0}
                step="0.01"
                value={Math.min(videoPreview.currentTime, videoDuration || 0)}
                disabled={!videoDuration}
                onChange={(event) => canvasRef.current?.seekVideo(Number(event.target.value))}
              />
            </label>

            <div className="sm-post-trim-head">
              <strong>Recorte</strong>
              <span>{formatVideoTime(trimStart)} → {formatVideoTime(trimEnd)}</span>
            </div>
            <div className="sm-post-trim-range" style={timelineStyle}>
              <div className="sm-post-trim-track" />
              <div className="sm-post-trim-selection" />
              <input
                className="sm-post-trim-handle is-start"
                aria-label="Início do recorte"
                type="range"
                min="0"
                max={videoDuration || 0}
                step="0.05"
                value={trimStart}
                disabled={!videoDuration}
                onChange={(event) => updateTrimStart(Number(event.target.value))}
              />
              <input
                className="sm-post-trim-handle is-end"
                aria-label="Fim do recorte"
                type="range"
                min="0"
                max={videoDuration || 0}
                step="0.05"
                value={trimEnd}
                disabled={!videoDuration}
                onChange={(event) => updateTrimEnd(Number(event.target.value))}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
