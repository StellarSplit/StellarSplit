import React, { useRef } from "react";
import { useCreateGroupFlow, STEPS } from "./useCreateGroupFlow";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Upload,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { cn, getInitials } from "@utils/format";
import {type Member, type Group } from "@src/types/split-group";
import { MemberList } from "./MemberList";
import {
  GROUP_EMOJIS,
  GROUP_COLORS,
  MEMBER_COLORS
} from "./data";

const STEPS = ["Details", "Avatar", "Members"] as const;

interface CreateGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (group: Group) => void;
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
}

function StepIndicator({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300",
                i < current &&
                  "bg-amber-500 text-zinc-900 scale-90",
                i === current &&
                  "bg-amber-500 text-zinc-900 ring-4 ring-amber-500/20",
                i > current && "bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700"
              )}
            >
              {i < current ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-xs font-medium transition-colors duration-200 text-theme",
                i === current ? "" : ""
              )}
            >
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "h-px w-8 mx-2 transition-colors duration-300",
                i < current ? "bg-amber-500" : "bg-zinc-700"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}


function DetailsStep({
  name,
  description,
  onNameChange,
  onDescriptionChange,
}: {
  name: string;
  description: string;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-zinc-300 text-xs font-semibold uppercase tracking-wider">
          Group Name *
        </Label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Barcelona Summer Trip"
          autoFocus
          className="bg-zinc-800/60 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50 h-11 text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-zinc-300 text-xs font-semibold uppercase tracking-wider">
          Description
          <span className="text-zinc-600 ml-1 normal-case font-normal">
            (optional)
          </span>
        </Label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="What's this group for?"
          rows={3}
          className="bg-zinc-800/60 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50 resize-none text-sm"
        />
      </div>
    </div>
  );
}

function AvatarStep({
  selectedEmoji,
  selectedColor,
  uploadedImage,
  onEmojiSelect,
  onColorSelect,
  onImageUpload,
}: {
  selectedEmoji: string;
  selectedColor: string;
  groupName: string;
  uploadedImage: string | null;
  onEmojiSelect: (e: string) => void;
  onColorSelect: (c: string) => void;
  onImageUpload: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onImageUpload(url);
  };

  return (
    <div className="space-y-6">
      {/* Preview */}
      <div className="flex justify-center">
        <div className="relative">
          <div
            className="h-24 w-24 rounded-3xl flex items-center justify-center text-4xl shadow-2xl ring-4 ring-zinc-800 overflow-hidden transition-all duration-300"
            style={{ backgroundColor: selectedColor + "22", borderColor: selectedColor + "55" }}
          >
            {uploadedImage ? (
              <img
                src={uploadedImage}
                alt="Group"
                className="h-full w-full object-cover"
              />
            ) : (
              selectedEmoji
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-zinc-700 border-2 border-zinc-900 flex items-center justify-center hover:bg-zinc-600 transition-colors"
            title="Upload image"
          >
            <Upload className="h-3.5 w-3.5 text-zinc-300" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      </div>

      {/* Emoji grid */}
      {!uploadedImage && (
        <div className="space-y-2">
          <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            Choose Icon
          </Label>
          <div className="grid grid-cols-8 gap-1.5">
            {GROUP_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onEmojiSelect(emoji)}
                className={cn(
                  "h-10 w-full rounded-lg text-xl flex items-center justify-center transition-all duration-150",
                  "hover:bg-zinc-700/80 hover:scale-110",
                  selectedEmoji === emoji
                    ? "bg-zinc-700 ring-2 ring-amber-500/60 scale-110"
                    : "bg-zinc-800/40"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color palette */}
      <div className="space-y-2">
        <Label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
          Accent Color
        </Label>
        <div className="flex gap-2 flex-wrap">
          {GROUP_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onColorSelect(color)}
              className={cn(
                "h-8 w-8 rounded-full transition-all duration-150 ring-2 ring-offset-2 ring-offset-zinc-900",
                selectedColor === color
                  ? "scale-110 ring-white/60"
                  : "ring-transparent hover:scale-105"
              )}
              style={{ backgroundColor: color }}
            >
              {selectedColor === color && (
                <Check className="h-4 w-4 text-white/90 mx-auto" strokeWidth={3} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Upload alternative */}
      {uploadedImage && (
        <button
          onClick={() => onImageUpload("")}
          className="w-full text-xs text-zinc-500 hover:text-red-400 transition-colors underline-offset-4 hover:underline"
        >
          Remove uploaded image
        </button>
      )}
    </div>
  );
}


export function CreateGroupModal({
  open,
  onOpenChange,
  onCreated,
  currentUserId = "me",
  currentUserName = "You",
  currentUserEmail = "you@example.com",
}: CreateGroupModalProps) {
  // Issue #508 — flow state extracted to useCreateGroupFlow hook
  const {
    stepIndex,
    currentStep,
    isFirst,
    isLast,
    canProceed,
    goNext,
    goBack,
    draft,
    setName,
    setDescription,
    setEmoji,
    setAccentColor,
    setUploadedImage,
    setMembers,
    reset,
    buildPayload,
  } = useCreateGroupFlow({ currentUserId, currentUserName, currentUserEmail });

  const { name, description, emoji, accentColor, uploadedImage, members } = draft;

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(reset, 300);
  };

  const handleCreate = () => {
    onCreated(buildPayload());
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-theme border-zinc-800 text-theme p-0 max-w-md overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] shadow-2xl shadow-black/60">
        {/* Gradient header bar */}
        <div
          className="h-1 w-full transition-all duration-500"
          style={{
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`,
          }}
        />

        <div className="px-6 pt-5 pb-2">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <DialogTitle className="text-lg font-bold text-zinc-100 tracking-tight">
                New Group
              </DialogTitle>
              <button
                onClick={handleClose}
                className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="pt-3">
              <StepIndicator steps={STEPS} current={stepIndex} />
            </div>
          </DialogHeader>
        </div>

        {/* Step content */}
        <div className="px-6 py-4 min-h-[300px]">
          {currentStep === "Details" && (
            <DetailsStep
              name={name}
              description={description}
              onNameChange={setName}
              onDescriptionChange={setDescription}
            />
          )}
          {currentStep === "Avatar" && (
            <AvatarStep
              selectedEmoji={emoji}
              selectedColor={accentColor}
              groupName={name}
              uploadedImage={uploadedImage}
              onEmojiSelect={setEmoji}
              onColorSelect={setAccentColor}
              onImageUpload={(url) => setUploadedImage(url || null)}
            />
          )}
          {currentStep === "Members" && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                {members.length} member{members.length !== 1 ? "s" : ""} · drag
                to reorder
              </p>
              <MemberList members={members} onChange={setMembers} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t-[0.5px] border-gray-300 bg-theme">
          <Button
            onClick={isFirst ? handleClose : goBack}
            className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            {isFirst ? (
              "Cancel"
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </>
            )}
          </Button>

          {isLast ? (
            <Button
              onClick={handleCreate}
              disabled={!canProceed}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-5 gap-2 transition-all"
            >
              <Sparkles className="h-4 w-4" />
              Create Group
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={!canProceed}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold px-5 gap-1 transition-all"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}