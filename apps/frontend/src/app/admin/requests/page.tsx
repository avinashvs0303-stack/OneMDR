import { redirect } from 'next/navigation';

export default function OldRequestsPage() {
  redirect('/admin/leads');
}
