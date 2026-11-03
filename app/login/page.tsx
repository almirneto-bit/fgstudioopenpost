import { redirect } from 'next/navigation';
import { V09_DEMO_MODE } from '@/lib/v09DemoMode';
import LoginClient from './LoginClient';
export default function LoginPage() {
  if (V09_DEMO_MODE) redirect('/');
  return <LoginClient />;
}
