import { redirect } from 'next/navigation';

export default function Home() {
  // The middleware has already decided whether this request is authenticated;
  // by the time we get here, the dashboard is always the right destination.
  redirect('/dashboard');
}
