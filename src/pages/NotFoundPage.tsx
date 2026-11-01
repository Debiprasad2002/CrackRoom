import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Layout';
import { EmptyState } from '@/components/ui/Feedback';

export default function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        className="py-16"
        icon={<Compass />}
        title="This page doesn't exist"
        description="The link may be broken or the page may have moved."
        action={<ButtonLink to="/">Go home</ButtonLink>}
      />
    </Card>
  );
}
