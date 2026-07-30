import { useTranslation } from "react-i18next";
import type {
  SplitRole,
  SplitStatus,
} from "../../services/splitHistoryRepository";

interface SplitCardProps {
  title: string;
  subtitle: string;
  amountLabel: string;
  status: SplitStatus;
  role: SplitRole;
  participants: string[];
}

const statusLabelKey: Record<SplitStatus, string> = {
  active: "history.statusActive",
  completed: "history.statusCompleted",
  cancelled: "history.statusCancelled",
};

const roleLabelKey: Record<SplitRole, string> = {
  creator: "history.roleCreator",
  participant: "history.roleParticipant",
};

export function SplitCard({ title, subtitle, amountLabel, status, role, participants }: SplitCardProps) {
  const { t } = useTranslation();
  const statusClass =
    status === "completed"
      ? "bg-green-50 text-green-700 border-green-200"
      : status === "active"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-300">{subtitle}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
          {participants.join(", ")}
        </p>
        <div className="mt-2 flex gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusClass}`}
          >
            {t(statusLabelKey[status])}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200">
            {t(roleLabelKey[role])}
          </span>
        </div>
      </div>
      <div className="mt-3 sm:mt-0 text-right">
        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{amountLabel}</div>
      </div>
    </div>
  );
}
