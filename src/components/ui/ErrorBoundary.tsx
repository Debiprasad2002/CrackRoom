import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Layout';
import { EmptyState } from './Feedback';

interface ErrorBoundaryProps {
  children: ReactNode;
}

/** Keeps the navigation on screen when a page crashes, so one bad record never leaves a blank window. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle />}
          title="This page could not load"
          description="Something went wrong on our side. Reload to try again, or use the menu to open another page."
        />
        <div className="pb-8 text-center">
          <Button onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </Card>
    );
  }
}
