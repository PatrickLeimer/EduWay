/**
 * Whether this app binary has the widget native modules. Expo Go has neither,
 * and both widget libraries throw when imported without them, so every widget
 * module in this folder is required lazily after one of these checks.
 */
import { requireOptionalNativeModule } from 'expo';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

export function hasIosWidgets(): boolean {
  return Platform.OS === 'ios' && requireOptionalNativeModule('ExpoWidgets') != null;
}

export function hasAndroidWidgets(): boolean {
  return (
    Platform.OS === 'android' &&
    (TurboModuleRegistry.get('AndroidWidget') != null || NativeModules.AndroidWidget != null)
  );
}
