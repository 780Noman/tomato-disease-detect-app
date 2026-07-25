import { EmptyState, Screen } from '@/components';

/**
 * The six-class reference library (symptoms, imagery, guidance) is Phase 8
 * content. The screen states that plainly rather than showing stub entries.
 */
export function LibraryScreen() {
  return (
    <Screen scroll={false} testID="library-screen">
      <EmptyState
        title="Disease library is not built yet"
        message="Reference pages for all six pest and deficiency conditions arrive in Phase 8, and will work fully offline."
      />
    </Screen>
  );
}
