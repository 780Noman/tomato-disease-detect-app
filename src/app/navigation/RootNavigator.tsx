import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';
import { ComponentGallery } from '@/dev/ComponentGallery';
import { useTheme } from '@/theme';
import { AuthScreen } from '@/screens/Auth/AuthScreen';
import { CameraScreen } from '@/screens/Camera/CameraScreen';
import { CaptureGuideScreen } from '@/screens/CaptureGuide/CaptureGuideScreen';
import { ConfirmPhotoScreen } from '@/screens/ConfirmPhoto/ConfirmPhotoScreen';
import { DiseaseDetailScreen } from '@/screens/DiseaseDetail/DiseaseDetailScreen';
import { ResultsScreen } from '@/screens/Results/ResultsScreen';
import { ScanDetailScreen } from '@/screens/ScanDetail/ScanDetailScreen';
import { HistoryScreen } from '@/screens/History/HistoryScreen';
import { HomeScreen } from '@/screens/Home/HomeScreen';
import { LibraryScreen } from '@/screens/Library/LibraryScreen';
import { SettingsScreen } from '@/screens/Settings/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.surface },
        headerTintColor: theme.color.text,
        headerTitleStyle: { color: theme.color.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.color.surface },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="CaptureGuide"
        component={CaptureGuideScreen}
        options={{ title: 'Capture guide' }}
      />
      <Stack.Screen name="Camera" component={CameraScreen} options={{ title: 'Camera' }} />
      <Stack.Screen
        name="ConfirmPhoto"
        component={ConfirmPhotoScreen}
        options={{ title: 'Check the photo' }}
      />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Diagnosis' }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Stack.Screen
        name="ScanDetail"
        component={ScanDetailScreen}
        options={{ title: 'Saved scan' }}
      />
      <Stack.Screen
        name="Library"
        component={LibraryScreen}
        options={{ title: 'Disease library' }}
      />
      <Stack.Screen
        name="DiseaseDetail"
        component={DiseaseDetailScreen}
        options={{ title: 'Condition' }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Auth" component={AuthScreen} options={{ title: 'Account' }} />
      {__DEV__ ? (
        <Stack.Screen
          name="Gallery"
          component={ComponentGallery}
          options={{ title: 'Component gallery (dev)' }}
        />
      ) : null}
    </Stack.Navigator>
  );
}
