import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Screen, Text } from '@/components';
import { ComponentGallery } from '@/dev/ComponentGallery';
import { ThemeProvider } from '@/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      {__DEV__ ? (
        // Dev builds show the gallery until navigation lands in Phase 3.
        <ComponentGallery />
      ) : (
        <ThemeProvider>
          <Screen>
            <Text variant="title" style={styles.center}>
              Tomato Leaf Doctor
            </Text>
            <Text tone="muted" style={styles.center}>
              Navigation and screens arrive in Phase 3.
            </Text>
          </Screen>
        </ThemeProvider>
      )}
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
