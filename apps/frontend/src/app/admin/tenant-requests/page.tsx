import { redirect } from 'next/navigation';

export default function OldTenantRequestsPage() {
  redirect('/admin/leads');
}
