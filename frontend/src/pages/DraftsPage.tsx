import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { draftRegistry } from '../services/draftRegistry';
import type { DraftMetadata } from '../types/draft';
import { Button } from '../components/ui/button';
import { Trash2, FileText, Receipt, Clock } from 'lucide-react';
import { formatRelativeTime } from '../utils/format';

const DRAFT_EXPIRY_DAYS = 30;

const DRAFT_TYPE_LABELS: Record<string, string> = {
  wizard: 'Split Draft',
  receipt: 'Receipt Draft',
};

function getDraftTypeLabel(type: string): string {
  return DRAFT_TYPE_LABELS[type] ?? `${type} draft`;
}

function getExpiresAt(updatedAt: string): Date {
  return new Date(new Date(updatedAt).getTime() + DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

function daysUntil(expiresAt: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftMetadata[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    setDrafts(draftRegistry.list());
  }, []);

  const handleDelete = (key: string) => {
    draftRegistry.delete(key);
    setDrafts(draftRegistry.list());
  };

  const handleResume = (draft: DraftMetadata) => {
    if (draft.type === 'wizard') {
      navigate('/create-split?resume=true');
    } else if (draft.type === 'receipt') {
      const splitId = draft.key.replace('receipt:', '');
      navigate(`/split/${splitId}`);
    }
  };

  // Hide drafts that are already expired (but not yet pruned from storage)
  const visibleDrafts = drafts.filter((draft) => {
    const expiresAt = getExpiresAt(draft.updatedAt);
    return expiresAt.getTime() > Date.now();
  });

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Drafts</h1>
      {visibleDrafts.length === 0 ? (
        <p className="text-muted-foreground">No drafts saved.</p>
      ) : (
        <div className="grid gap-4">
          {visibleDrafts.map((draft) => {
            const expiresAt = getExpiresAt(draft.updatedAt);
            const daysLeft = daysUntil(expiresAt);
            return (
              <div
                key={draft.key}
                className="rounded-2xl border border-theme bg-card-theme p-5 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  {draft.type === 'wizard' ? (
                    <FileText className="h-5 w-5" />
                  ) : (
                    <Receipt className="h-5 w-5" />
                  )}
                  <h3 className="text-lg font-semibold">
                    {draft.title || getDraftTypeLabel(draft.type)}
                  </h3>
                  <span className="ml-auto text-xs font-medium px-2 py-1 rounded-full bg-surface text-muted-theme">
                    {getDraftTypeLabel(draft.type)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  Last updated: {new Date(draft.updatedAt).toLocaleString()}
                </p>
                <p className="text-sm text-muted-theme flex items-center gap-1 mb-4">
                  <Clock className="h-3.5 w-3.5" />
                  {daysLeft === 0 ? (
                    <span>Expires today</span>
                  ) : (
                    <span>Expires in {daysLeft} day{daysLeft > 1 ? 's' : ''}</span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => handleResume(draft)} variant="default">
                    Resume
                  </Button>
                  <Button onClick={() => handleDelete(draft.key)} variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}