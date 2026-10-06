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
import {
  getCloudProject,
  listCloudProjects,
  saveCloudProject,
} from '@/lib/smPostCloudStorage';
import {
  applyAutoLayoutChanges,
  buildAutoLayoutState,
  sanitizeAutoLayoutChanges,
  type AutoLayoutChange,
} from '@/lib/autoLayout';

type EditorTab = 'edit' | 'advanced';
type ExportFormat = 'png' | 'gif' | 'mp4';
type VideoPreviewState = { duration: number; currentTime: number; isPlaying: boolean };
type CloudSaveState = 'not_saved' | 'saved' | 'dirty' | 'saving' | 'error';
type AutoLayoutState = 'idle' | 'loading' | 'preview' | 'error';
type AutoLayoutMode = 'balanced' | 'readability' | 'headline';

const EMPTY_VIDEO_PREVIEW: VideoPreviewState = { duration: 0, currentTime: 0, isPlaying: false };

function formatVideoTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remaining = Math.floor(safe % 60);
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

async function blobToPreviewDataUrl(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = 540;
  canvas.height = 720;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a prévia para a IA.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.72);
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

function formatHistoryDate(timestamp: number) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
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
  const [cloudSaveState, setCloudSaveState] = useState<CloudSaveState>('not_saved');
  const [cloudErrorDetail, setCloudErrorDetail] = useState('');
  const [autoLayoutState, setAutoLayoutState] = useState<AutoLayoutState>('idle');
  const [autoLayoutSummary, setAutoLayoutSummary] = useState('');
  const [autoLayoutChanges, setAutoLayoutChanges] = useState<AutoLayoutChange[]>([]);
  const [autoLayoutPreviewFields, setAutoLayoutPreviewFields] = useState<SmPostFields | null>(null);
  const [autoLayoutDetail, setAutoLayoutDetail] = useState('');
  const [autoLayoutMode, setAutoLayoutMode] = useState<AutoLayoutMode>('balanced');
  const canvasRef = useRef<SmPostCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const localRecent = await listProjects();
        let cloudRecent: SmPostProject[] = [];
        try {
          cloudRecent = await listCloudProjects();
        } catch {
          // O editor continua disponível com o autosave local mesmo sem conexão com a nuvem.
        }

        const activeId = localStorage.getItem(ACTIVE_PROJECT_KEY);
        const localActive = activeId ? await getProject(activeId) : null;
        const nextProject = normalizeProject(localActive ?? cloudRecent[0] ?? localRecent[0] ?? createProject());
        const cloudVersion = cloudRecent.find((saved) => saved.id === nextProject.id);

        if (!cancelled) {
          setProject(nextProject);
          setHistory(cloudRecent.map(normalizeProject));
          setCloudSaveState(
            cloudVersion
              ? (nextProject.updatedAt > cloudVersion.updatedAt ? 'dirty' : 'saved')
              : 'not_saved',
          );
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
        await saveProject(project);
        localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
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

  useEffect(() => {
    setAutoLayoutState('idle');
    setAutoLayoutSummary('');
    setAutoLayoutChanges([]);
    setAutoLayoutPreviewFields(null);
  }, [activeSlide?.id, fields?.layoutId]);

  const updateProject = (recipe: (current: SmPostProject) => SmPostProject) => {
    setProject((current) => current ? { ...recipe(current), updatedAt: Date.now() } : current);
    setCloudSaveState((current) => (
      current === 'saved' || current === 'dirty' || current === 'error' ? 'dirty' : current
    ));
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
      await saveProject(project);
      const next = createProject();
      setProject(next);
      setCloudSaveState('not_saved');
      localStorage.setItem(ACTIVE_PROJECT_KEY, next.id);
      setActiveTab('edit');
      setExportFormat('png');
      setError('');
    } catch {
      setError('Não foi possível salvar a criação atual antes de iniciar outra.');
    }
  };

  const saveToHistory = async () => {
    if (!project || cloudSaveState === 'saving') return;
    setCloudSaveState('saving');
    setCloudErrorDetail('');
    try {
      await saveCloudProject(project);
      const recent = await listCloudProjects();
      setHistory(recent.map(normalizeProject));
      setCloudSaveState('saved');
      setError('');
    } catch (cloudError) {
      setCloudSaveState('error');

      const supabaseError = cloudError as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };

      const detail = [
        supabaseError?.message,
        supabaseError?.details,
        supabaseError?.hint,
        supabaseError?.code ? `Código: ${supabaseError.code}` : '',
      ].filter(Boolean).join(' · ') || (cloudError instanceof Error ? cloudError.message : String(cloudError));

      setCloudErrorDetail(detail);
      setError(`Não foi possível salvar esta criação no histórico online. Supabase: ${detail}. O autosave local continua ativo.`);
    }
  };

  const openProject = async (projectId: string) => {
    if (!project || projectId === project.id) return;
    try {
      await saveProject(project);
      const saved = await getCloudProject(projectId);
      if (!saved) return;
      const next = normalizeProject(saved);
      await saveProject(next);
      setProject(next);
      setCloudSaveState('saved');
      localStorage.setItem(ACTIVE_PROJECT_KEY, next.id);
      setExportFormat('png');
      setError('');
    } catch {
      setError('Não foi possível abrir essa criação do histórico.');
    }
  };

  const requestAutoLayout = async () => {
    if (!fields || autoLayoutState === 'loading') return;
    setAutoLayoutState('loading');
    setAutoLayoutSummary('');
    setAutoLayoutChanges([]);
    setAutoLayoutPreviewFields(null);
    setAutoLayoutDetail('');
    setError('');

    try {
      let screenshotDataUrl: string | undefined;
      try {
        const screenshot = await canvasRef.current?.exportPng();
        if (screenshot) screenshotDataUrl = await blobToPreviewDataUrl(screenshot);
      } catch {
        // O estado estruturado continua suficiente para o teste caso a captura não esteja disponível.
      }

      const response = await fetch('/api/auto-layout-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: buildAutoLayoutState(fields, autoLayoutMode),
          screenshotDataUrl,
          mode: autoLayoutMode,
        }),
      });

      const raw = await response.text();
      let payload: {
        error?: string;
        detail?: string;
        summary?: string;
        changes?: unknown;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
        backendVersion?: string;
        meta?: {
          model?: string | null;
          creditsConsumed?: number | null;
          backendVersion?: string | null;
        };
      } = {};
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        throw new Error(`A rota /api/auto-layout-v2 respondeu ${response.status}, mas não retornou JSON. Isso indica que o deploy ainda não contém a nova função.`);
      }
      if (!response.ok) {
        throw new Error([payload.error, payload.detail, payload.backendVersion ? `backend ${payload.backendVersion}` : ''].filter(Boolean).join(' · ') || `Não foi possível gerar o Auto Layout (HTTP ${response.status}).`);
      }

      const changes = sanitizeAutoLayoutChanges(payload.changes);
      if (!changes.length) {
        setAutoLayoutSummary(payload.summary || 'A IA não encontrou nenhuma alteração útil dentro das propriedades liberadas nesta versão.');
        setAutoLayoutDetail(`0 alterações retornadas pela IA.${payload.meta?.backendVersion || payload.backendVersion ? ` Backend ${payload.meta?.backendVersion ?? payload.backendVersion}.` : ''}`);
        setAutoLayoutState('preview');
        return;
      }

      setAutoLayoutChanges(changes);
      setAutoLayoutSummary(payload.summary || 'Sugestão de Auto Layout pronta.');
      setAutoLayoutDetail([payload.usage?.total_tokens ? `${payload.usage.total_tokens} tokens usados` : 'Resposta da IA recebida', payload.meta?.model ? `modelo ${payload.meta.model}` : '', payload.meta?.backendVersion || payload.backendVersion ? `backend ${payload.meta?.backendVersion ?? payload.backendVersion}` : ''].filter(Boolean).join(' · '));
      setAutoLayoutPreviewFields(applyAutoLayoutChanges(fields, changes, autoLayoutMode));
      setAutoLayoutState('preview');
    } catch (autoLayoutError) {
      const message = autoLayoutError instanceof Error ? autoLayoutError.message : 'Falha ao gerar Auto Layout.';
      setAutoLayoutState('error');
      setAutoLayoutDetail(message);
      setError(`Auto Layout: ${message}`);
    }
  };

  const applyAutoLayout = () => {
    if (!autoLayoutPreviewFields || !activeSlide) {
      setAutoLayoutState('idle');
      return;
    }
    updateProject((current) => ({
      ...current,
      slides: current.slides.map((slide) => slide.id === activeSlide.id
        ? { ...slide, fields: autoLayoutPreviewFields }
        : slide),
    }));
    setAutoLayoutState('idle');
    setAutoLayoutSummary('');
    setAutoLayoutChanges([]);
    setAutoLayoutPreviewFields(null);
    setAutoLayoutDetail('');
  };

  const discardAutoLayout = () => {
    setAutoLayoutState('idle');
    setAutoLayoutSummary('');
    setAutoLayoutChanges([]);
    setAutoLayoutPreviewFields(null);
    setAutoLayoutDetail('');
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

  const displayFields = autoLayoutPreviewFields ?? fields;
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
        <h1>FG Post Studio <small>Editor de carrossel · v08-beta</small></h1>
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
        <button
          type="button"
          className={`sm-post-cloud-save is-${cloudSaveState}`}
          onClick={saveToHistory}
          disabled={cloudSaveState === 'saving'}
          title={cloudSaveState === 'not_saved' ? 'Salvar criação no histórico' : 'Salvar alterações no histórico'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 3h12l2 2v16H5V3Zm2 2v5h9V5H7Zm0 14h10v-6H7v6Zm2-12h5v1H9V7Z" fill="currentColor" />
          </svg>
          <span>
            {cloudSaveState === 'saving'
              ? 'Salvando no histórico...'
              : cloudSaveState === 'saved'
                ? 'Salvo no histórico'
                : cloudSaveState === 'dirty'
                  ? 'Salvar alterações'
                  : cloudSaveState === 'error'
                    ? 'Tentar salvar novamente'
                    : 'Salvar no histórico'}
          </span>
        </button>
        <small className={`sm-post-cloud-status is-${cloudSaveState}`}>
          {cloudSaveState === 'saved'
            ? 'Esta versão está salva online.'
            : cloudSaveState === 'dirty'
              ? 'Há alterações ainda não salvas no histórico.'
              : cloudSaveState === 'error'
                ? `Falha ao salvar online. ${cloudErrorDetail ? `Supabase: ${cloudErrorDetail}` : 'Seu rascunho continua salvo localmente.'}`
                : cloudSaveState === 'saving'
                  ? 'Enviando esta versão para o Supabase.'
                  : 'Rascunho local. Salve quando quiser adicionar ao histórico.'}
        </small>

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
          <div className="sm-post-section-head"><span>Histórico</span><small>{history.length}</small></div>
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
                <small>
                  {saved.slides.length} {saved.slides.length === 1 ? 'lâmina' : 'lâminas'} · editado em {formatHistoryDate(saved.updatedAt)}
                </small>
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
            <div className="sm-post-section-head sm-post-auto-layout-head">
              <span>Conteúdo da lâmina {activeIndex + 1}</span>
              <div className="sm-post-auto-layout-tools">
                <select
                  className="sm-post-auto-layout-mode"
                  value={autoLayoutMode}
                  onChange={(event) => setAutoLayoutMode(event.target.value as AutoLayoutMode)}
                  aria-label="Modo do Auto Layout"
                >
                  <option value="balanced">Equilibrado</option>
                  <option value="readability">Legibilidade</option>
                  <option value="headline">Headline forte</option>
                </select>
              <button
                type="button"
                className="sm-post-auto-layout-btn"
                onClick={requestAutoLayout}
                disabled={autoLayoutState === 'loading'}
              >
                {autoLayoutState === 'loading' ? 'Analisando…' : '✦ Auto Layout'}
              </button>
              </div>
            </div>

            {autoLayoutState === 'error' && (
              <div className="sm-post-auto-layout-preview is-error">
                <div>
                  <strong>Auto Layout não executado</strong>
                  <p>{autoLayoutDetail || 'A chamada para a IA falhou.'}</p>
                  <small>Nenhuma alteração foi feita no layout.</small>
                </div>
              </div>
            )}

            {autoLayoutState === 'preview' && (
              <div className="sm-post-auto-layout-preview">
                <div>
                  <strong>Prévia do Auto Layout</strong>
                  <p>{autoLayoutSummary}</p>
                  <small>
                    {autoLayoutChanges.length > 0
                      ? `${autoLayoutChanges.length} ${autoLayoutChanges.length === 1 ? 'ajuste sugerido' : 'ajustes sugeridos'} · nada foi salvo ainda.`
                      : 'Nenhum ajuste aplicado.'}
                    {autoLayoutDetail ? ` · ${autoLayoutDetail}` : ''}
                  </small>
                </div>
                <div className="sm-post-auto-layout-actions">
                  <button type="button" onClick={discardAutoLayout}>Descartar</button>
                  <button type="button" className="is-primary" onClick={applyAutoLayout} disabled={!autoLayoutPreviewFields}>Aplicar</button>
                </div>
              </div>
            )}

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
                <label className="sm-post-field sm-post-range-field">
                  <span>Posição horizontal <strong>{fields.imageOffsetX > 0 ? '+' : ''}{fields.imageOffsetX}px</strong></span>
                  <input type="range" min="-800" max="800" step="5" value={fields.imageOffsetX} onChange={(event) => setField('imageOffsetX', Number(event.target.value))} />
                </label>
                <label className="sm-post-field sm-post-range-field">
                  <span>Posição vertical <strong>{fields.imageOffsetY > 0 ? '+' : ''}{fields.imageOffsetY}px</strong></span>
                  <input type="range" min="-800" max="800" step="5" value={fields.imageOffsetY} onChange={(event) => setField('imageOffsetY', Number(event.target.value))} />
                </label>
                {(fields.imageOffsetX !== 0 || fields.imageOffsetY !== 0) && (
                  <button type="button" className="sm-post-reset-media-position" onClick={() => {
                    setField('imageOffsetX', 0);
                    setField('imageOffsetY', 0);
                  }}>Centralizar mídia</button>
                )}
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
                  <input type="range" min="-360" max="180" step="2" value={fields.headlineBodyOffset} onChange={(event) => setField('headlineBodyOffset', Number(event.target.value))} />
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
          O editor salva automaticamente um rascunho local. Use “Salvar no histórico” para enviar ou atualizar uma criação no Supabase.
          {project.slides.some((slide) => slide.fields.mediaType === 'video') && ' No ZIP do carrossel, vídeos usam o primeiro frame em PNG.'}
        </p>
      </section>

      <main className={displayFields.mediaType === 'video' ? 'sm-post-stage has-video' : 'sm-post-stage'}>
        <div className="sm-post-canvas-wrap">
          <SmPostCanvas
            ref={canvasRef}
            fields={displayFields}
            onError={setError}
            onVideoStateChange={setVideoPreview}
            editable={!autoLayoutPreviewFields}
            onTextChange={(field, value) => setField(field, value)}
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
        <div className="sm-post-canvas-edit-hint">Duplo clique em um texto para editar direto na arte.</div>

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
