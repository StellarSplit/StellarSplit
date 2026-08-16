import { useAnnounce } from '../hooks/useAccessibility';

/**
 * LiveRegion — renders a screen-reader-only live region driven by useAnnounce().
 *
 * Place this once at the app root (e.g. inside AppProviders). Any component
 * that calls announce() from useAnnounce will have its message announced by
 * assistive technology.
 *
 * The double-announce technique (clear then set) ensures repeated identical
 * messages are still picked up by screen readers.
 */
export function LiveRegion() {
  const { message } = useAnnounce();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      /**
       * Double-announce: clearing the text content first ensures the
       * mutation observer fires even when the same message is announced
       * twice in a row (e.g. two consecutive "split created" events).
       */
      key={message || 'empty'}
    >
      {message}
    </div>
  );
}