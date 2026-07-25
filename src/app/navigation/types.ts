/**
 * The typed route map. Screens consume it via NativeStackScreenProps.
 * Routes are added here in the phase that makes them reachable — a route
 * with no working destination is a lie in the type system.
 */
export type RootStackParamList = {
  Home: undefined;
  CaptureGuide: undefined;
  /** Capture flow lands in Phase 6; until then the screen states that plainly. */
  Camera: undefined;
  History: undefined;
  Library: undefined;
  Settings: undefined;
  /** Registered in dev builds only (RootNavigator guards it). */
  Gallery: undefined;
};

declare global {
  // Lets bare `useNavigation()` calls pick up the typed param list.
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
