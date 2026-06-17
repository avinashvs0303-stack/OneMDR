import { redirect } from 'next/navigation';

// Root always redirects to login; the middleware then bounces authenticated
// users to /dashboard. This keeps routing logic in one place (middleware).
export default function HomePage() {
  redirect('/auth/login');
}
