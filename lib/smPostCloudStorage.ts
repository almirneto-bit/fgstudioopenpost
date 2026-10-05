import { createClient } from '@/lib/supabase/client';
import type { SmPostProject } from './smPostStorage';

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
  const { error } = await supabase
    .from('fg_projects')
    .upsert(
      {
        id: project.id,
        name: project.name,
        slides: project.slides,
        active_slide_id: project.activeSlideId,
        created_at: new Date(project.createdAt).toISOString(),
        updated_at: new Date(project.updatedAt).toISOString(),
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
