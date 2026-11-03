import { getUser } from '@netlify/identity';
import { redirect } from 'next/navigation';
import SmPostEditor from '@/components/post/SmPostEditor';

export const dynamic = 'force-dynamic';

export default async function CreatePage() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (!user.roles?.includes('admin') && !user.roles?.includes('creator')) redirect('/sem-acesso');
  return <SmPostEditor />;
}
