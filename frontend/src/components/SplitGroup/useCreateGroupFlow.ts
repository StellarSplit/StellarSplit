/**
 * useCreateGroupFlow.ts — Issue #508
 *
 * Encapsulates all mutable wizard state for the group-creation modal:
 * step transitions, draft field values, avatar selection, member curation,
 * validation gating, reset-on-close, and payload generation.
 *
 * The modal component stays declarative — it only renders; all flow logic
 * lives here and is trivially testable without rendering anything.
 */

import { useCallback, useState } from 'react';
import { getInitials } from '@utils/format';
import type { Group, Member } from '@src/types/split-group';
import { GROUP_COLORS, MEMBER_COLORS } from './data';

// ── Step definitions ───────────────────────────────────────────────────────────

export const STEPS = ['Details', 'Avatar', 'Members'] as const;
export type Step = (typeof STEPS)[number];

// ── Draft state ────────────────────────────────────────────────────────────────

export interface CreateGroupDraft {
  name: string;
  description: string;
  emoji: string;
  accentColor: string;
  uploadedImage: string | null;
  members: Member[];
}

function buildOwner(
  currentUserId: string,
  currentUserName: string,
  currentUserEmail: string
): Member {
  return {
    id: currentUserId,
    name: currentUserName,
    email: currentUserEmail,
    initials: getInitials(currentUserName),
    color: MEMBER_COLORS[0],
    role: 'owner',
  };
}

function initialDraft(
  currentUserId: string,
  currentUserName: string,
  currentUserEmail: string
): CreateGroupDraft {
  return {
    name: '',
    description: '',
    emoji: '🎉',
    accentColor: GROUP_COLORS[0],
    uploadedImage: null,
    members: [buildOwner(currentUserId, currentUserName, currentUserEmail)],
  };
}

// ── Validation ─────────────────────────────────────────────────────────────────

function canProceedFromStep(step: Step, draft: CreateGroupDraft): boolean {
  if (step === 'Details') return draft.name.trim().length >= 2;
  return true;
}

// ── Payload builder ────────────────────────────────────────────────────────────

function buildGroupPayload(draft: CreateGroupDraft): Group {
  return {
    id: `g_${Date.now()}`,
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    emoji: draft.emoji,
    accentColor: draft.accentColor,
    members: draft.members,
    totalSpent: 0,
    currency: 'USD',
    createdAt: new Date(),
    lastActivityAt: new Date(),
  };
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface UseCreateGroupFlowOptions {
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
}

export interface UseCreateGroupFlowReturn {
  // Step navigation
  stepIndex: number;
  currentStep: Step;
  isFirst: boolean;
  isLast: boolean;
  canProceed: boolean;
  goNext: () => void;
  goBack: () => void;

  // Draft field setters
  draft: CreateGroupDraft;
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setEmoji: (emoji: string) => void;
  setAccentColor: (color: string) => void;
  setUploadedImage: (image: string | null) => void;
  setMembers: (members: Member[]) => void;

  // Actions
  reset: () => void;
  buildPayload: () => Group;
}

export function useCreateGroupFlow({
  currentUserId = 'me',
  currentUserName = 'You',
  currentUserEmail = 'you@example.com',
}: UseCreateGroupFlowOptions = {}): UseCreateGroupFlowReturn {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<CreateGroupDraft>(() =>
    initialDraft(currentUserId, currentUserName, currentUserEmail)
  );

  const currentStep = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const canProceed = canProceedFromStep(currentStep, draft);

  const goNext = useCallback(() => {
    if (!isLast && canProceed) setStepIndex((i) => i + 1);
  }, [isLast, canProceed]);

  const goBack = useCallback(() => {
    if (!isFirst) setStepIndex((i) => i - 1);
  }, [isFirst]);

  const reset = useCallback(() => {
    setStepIndex(0);
    setDraft(initialDraft(currentUserId, currentUserName, currentUserEmail));
  }, [currentUserId, currentUserName, currentUserEmail]);

  const setField = <K extends keyof CreateGroupDraft>(key: K) =>
    (value: CreateGroupDraft[K]) =>
      setDraft((prev) => ({ ...prev, [key]: value }));

  const buildPayload = useCallback(() => buildGroupPayload(draft), [draft]);

  return {
    stepIndex,
    currentStep,
    isFirst,
    isLast,
    canProceed,
    goNext,
    goBack,
    draft,
    setName: setField('name'),
    setDescription: setField('description'),
    setEmoji: setField('emoji'),
    setAccentColor: setField('accentColor'),
    setUploadedImage: setField('uploadedImage'),
    setMembers: setField('members'),
    reset,
    buildPayload,
  };
}
