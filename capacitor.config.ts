import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.joshlin.dreamlive.pro',
  appName: 'Dream Live Pro',
  webDir: 'build',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  ios: {
    allowsLinkPreview: false,
    handleApplicationNotifications: true,
    contentInset: 'never',
    preferredContentMode: 'mobile',
    allowsInlineMediaPlayback: true,
  }
};

export default config;
