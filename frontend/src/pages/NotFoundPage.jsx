import { Link } from 'react-router-dom';
import { BookX } from 'lucide-react';
import { EmptyState } from '../components/ui/Feedback';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={BookX}
      title="This page is not on our shelves"
      description="The link may be broken, or the page may have been moved."
      action={
        <Link to="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      }
    />
  );
}
