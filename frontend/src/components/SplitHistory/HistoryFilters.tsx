import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { SplitStatus, SplitRole } from "../../services/splitHistoryRepository";

export type SortOption =
  | "date-desc"
  | "date-asc"
  | "amount-desc"
  | "amount-asc"
  | "status";

export interface FiltersState {
  statuses: Set<SplitStatus>;
  role: "all" | SplitRole;
  search: string;
  sort: SortOption;
}

interface HistoryFiltersProps {
  value: FiltersState;
  onChange: (next: FiltersState) => void;
}

const statusLabelKey: Record<SplitStatus, string> = {
  active: "history.statusActive",
  completed: "history.statusCompleted",
  cancelled: "history.statusCancelled",
};

export function HistoryFilters({ value, onChange }: HistoryFiltersProps) {
  const { t } = useTranslation();
  const statusList = useMemo<SplitStatus[]>(() => ["active", "completed", "cancelled"], []);

  const toggleStatus = (s: SplitStatus) => {
    const next = new Set(value.statuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    onChange({ ...value, statuses: next });
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label
            htmlFor="history-search"
            className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
          >
            {t("history.search")}
          </label>
          <input
            id="history-search"
            type="text"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder={t("history.searchPlaceholder")}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>

        {/* Status */}
        <div>
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
            {t("history.status")}
          </span>
          <div className="flex flex-wrap gap-2">
            {statusList.map((s) => {
              const active = value.statuses.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? s === "completed"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : s === "active"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700"
                  }`}
                >
                  {t(statusLabelKey[s])}
                </button>
              );
            })}
          </div>
        </div>

        {/* Role */}
        <div>
          <label
            htmlFor="history-role"
            className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
          >
            {t("history.role")}
          </label>
          <select
            id="history-role"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            value={value.role}
            onChange={(e) => onChange({ ...value, role: e.target.value as FiltersState["role"] })}
          >
            <option value="all">{t("history.roleAll")}</option>
            <option value="creator">{t("history.roleCreator")}</option>
            <option value="participant">{t("history.roleParticipant")}</option>
          </select>
        </div>

        {/* Sort */}
        <div>
          <label
            htmlFor="history-sort"
            className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1"
          >
            {t("history.sort")}
          </label>
          <select
            id="history-sort"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            value={value.sort}
            onChange={(e) => onChange({ ...value, sort: e.target.value as SortOption })}
          >
            <option value="date-desc">{t("history.sortDateDesc")}</option>
            <option value="date-asc">{t("history.sortDateAsc")}</option>
            <option value="amount-desc">{t("history.sortAmountDesc")}</option>
            <option value="amount-asc">{t("history.sortAmountAsc")}</option>
            <option value="status">{t("history.sortByStatus")}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
