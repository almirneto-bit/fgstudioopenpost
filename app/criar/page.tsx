import { getUser } from '@netlify/identity';
import { redirect } from 'next/navigation';
import { V09_DEMO_MODE } from '@/lib/v09DemoMode';
import SmPostEditor from '@/components/post/SmPostEditor';

export const dynamic = 'force-dynamic';

export default async function CreatePage() {
  if (!V09_DEMO_MODE) {
    const user = await getUser();
    if (!user) redirect('/login');
    if (!user.roles?.includes('admin') && !user.roles?.includes('creator')) redirect('/sem-acesso');
  }
  return <SmPostEditor />;
}
