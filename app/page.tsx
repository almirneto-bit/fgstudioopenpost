import { getUser } from '@netlify/identity';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.roles.includes('admin')) redirect('/admin');
  if (user.roles.includes('creator')) redirect('/criar');
  redirect('/sem-acesso');
}
