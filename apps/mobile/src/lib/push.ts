/**
 * Push bildirim kaydı. Giriş sonrası cihazın Expo push token'ını alıp
 * sunucuya (/api/me/push-token) kaydeder; böylece devamsızlık/sınav sonucu/
 * taksit hatırlatma olaylarında sunucu bu cihaza bildirim gönderebilir
 * (bkz. apps/web/lib/push.ts).
 *
 * AKTİVASYON: Expo push token'ı için bir EAS projectId gerekir. Bir kez
 *   npx eas init
 * çalıştırın (app.json'a extra.eas.projectId yazılır). O olmadan token
 * alınamaz ve bu fonksiyon sessizce hiçbir şey yapmaz (uygulama çalışmaya
 * devam eder). Fiziksel cihaz gerekir (simülatör/emülatör token vermez).
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from '@/lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return; // simülatör/emülatör push token vermez

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bildirimler',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return; // eas init yapılmamış — sessizce atla

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    if (tokenData?.data) {
      await api.post('/api/me/push-token', { token: tokenData.data, platform: Platform.OS });
    }
  } catch {
    // best-effort — bildirim kaydı asla uygulamayı düşürmez
  }
}
