import { getUser } from '@netlify/identity';
import { redirect } from 'next/navigation';
import { V09_DEMO_MODE } from '@/lib/v09DemoMode';
import PsdCreator from './PsdCreator';

export const dynamic = 'force-dynamic';

export default async function PsdCreatorPage({ params }: { params: Promise<{id:string}> }) {
  if (!V09_DEMO_MODE) {
    const user = await getUser();
    if (!user) redirect('/login');
    if (!user.roles?.includes('admin') && !user.roles?.includes('creator')) redirect('/sem-acesso');
  }
  const {id} = await params;
  return <PsdCreator id={id}/>;
}
