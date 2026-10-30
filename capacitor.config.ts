import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.millenniumsnake.game',
  appName: 'Millennium Snake',
  webDir: 'dist',
  backgroundColor: '#171522',
  android: { backgroundColor: '#171522', allowMixedContent: false },
};

export default config;
