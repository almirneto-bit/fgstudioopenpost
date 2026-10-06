import { createClient } from '@/lib/supabase/client';
import type { SmPostProject } from './smPostStorage';

const MEDIA_BUCKET = 'fg-studio-media';

type CloudProjectRow = {
  id: string;
  name: string;
  slides: SmPostProject['slides'];
  active_slide_id: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: CloudProjectRow): SmPostProject {
  return {
    id: row.id,
    name: row.name,
    slides: row.slides ?? [],
    activeSlideId: row.active_slide_id ?? row.slides?.[0]?.id ?? '',
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function extensionFromMime(mime: string) {
  const subtype = mime.split('/')[1]?.split(';')[0]?.toLowerCase() ?? '';
  if (subtype === 'jpeg') return 'jpg';
  if (subtype === 'quicktime') return 'mov';
  return subtype || 'bin';
}

async function uploadMediaIfNeeded(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  slideId: string,
  mediaUrl: string | null,
): Promise<string | null> {
  if (!mediaUrl) return null;
  if (!mediaUrl.startsWith('data:') && !mediaUrl.startsWith('blob:')) return mediaUrl;

  const response = await fetch(mediaUrl);
  if (!response.ok) throw new Error('Não foi possível preparar a mídia para o histórico.');

  const blob = await response.blob();
  const extension = extensionFromMime(blob.type);
  const path = `${projectId}/${slideId}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || undefined,
      upsert: true,
      cacheControl: '3600',
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function prepareProjectForCloud(
  supabase: ReturnType<typeof createClient>,
  project: SmPostProject,
): Promise<SmPostProject> {
  const slides = await Promise.all(
    project.slides.map(async (slide) => ({
      ...slide,
      fields: {
        ...slide.fields,
        imageUrl: await uploadMediaIfNeeded(
          supabase,
          project.id,
          slide.id,
          slide.fields.imageUrl ?? null,
        ),
      },
    })),
  );

  return {
    ...project,
    slides,
  };
}

export async function listCloudProjects(): Promise<SmPostProject[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fg_projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as CloudProjectRow[]).map(fromRow);
}

export async function getCloudProject(id: string): Promise<SmPostProject | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fg_projects')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as CloudProjectRow) : null;
}

export async function saveCloudProject(project: SmPostProject): Promise<void> {
  const supabase = createClient();
  const cloudProject = await prepareProjectForCloud(supabase, project);

  const { error } = await supabase
    .from('fg_projects')
    .upsert(
      {
        id: cloudProject.id,
        name: cloudProject.name,
        slides: cloudProject.slides,
        active_slide_id: cloudProject.activeSlideId,
        created_at: new Date(cloudProject.createdAt).toISOString(),
        updated_at: new Date(cloudProject.updatedAt).toISOString(),
      },
      { onConflict: 'id' },
    );

  if (error) throw error;
}

export async function deleteCloudProject(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('fg_projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
