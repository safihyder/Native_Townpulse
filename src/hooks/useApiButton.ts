import { useCallback, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';

/**
 * Hook to wrap an async function with automatic loading state + error toast.
 *
 * Usage:
 * ```tsx
 * const { isLoading, run } = useApiButton();
 *
 * <ActionButton
 *   label="Save"
 *   onPress={() => run(saveProfile)}
 *   isLoading={isLoading}
 * />
 * ```
 */
export function useApiButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();
  const mountedRef = useRef(true);

  // Track mount state to avoid setting state on unmounted component
  // (useEffect cleanup runs on unmount)
  const run = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      opts?: {
        successMessage?: string;
        errorTitle?: string;
        showSuccessToast?: boolean;
      },
    ): Promise<T | undefined> => {
      if (isLoading) return undefined;
      setIsLoading(true);
      try {
        const result = await fn();
        if (opts?.showSuccessToast && opts?.successMessage) {
          showToast({
            type: 'success',
            title: opts.successMessage,
          });
        }
        return result;
      } catch (err: any) {
        const msg = err?.message || 'Something went wrong. Please try again.';
        showToast({
          type: 'error',
          title: opts?.errorTitle || 'Error',
          body: msg,
        });
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, showToast],
  );

  return { isLoading, run };
}
