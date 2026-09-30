/**
 * iPhone home-screen widget (expo-widgets): a teal tile with "Drive", the
 * clean-drive streak and the last score. Tapping it opens eduway://drive/start
 * (trip/driveLink.ts). Load only after hasIosWidgets() (nativeWidgets.ts):
 * importing expo-widgets in Expo Go throws.
 *
 * The 'widget' function runs in an isolated runtime inside the widget
 * extension: only @expo/ui/swift-ui components and modifiers, no imports or
 * module constants. So theme colors, sizes, text and the URL arrive as props
 * from syncDriveWidget.ts, and the font is the system font (Lexend is not
 * bundled into the extension). The system rounds and clips the tile, so there
 * is no lip.
 */
import { HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

/** Name in app.json (expo-widgets plugin `widgets[].name`). */
export const DRIVE_WIDGET_NAME = 'DriveWidget';

export interface DriveWidgetProps {
  url: string;
  streak: string;
  streakLabel: string;
  lastLine: string;
  background: string;
  text: string;
  textMuted: string;
  ctaSize: number;
  streakSize: number;
  labelSize: number;
  lastSize: number;
}

function DriveWidgetLayout(props: Partial<DriveWidgetProps>) {
  'widget';
  // Until the app has run once there are no props; the tile still opens the drive link.
  const color = (c?: string) => (c ? [foregroundStyle(c)] : []);
  return (
    <VStack
      spacing={2}
      modifiers={[
        widgetURL(props.url ?? 'eduway://drive/start'),
        ...(props.background ? [containerBackground(props.background, 'widget')] : []),
      ]}
    >
      <HStack spacing={4}>
        <Image systemName="steeringwheel" size={props.ctaSize ?? 16} color={props.text} />
        <Text
          modifiers={[
            font({ size: props.ctaSize ?? 16, weight: 'semibold' }),
            ...color(props.text),
          ]}
        >
          Drive
        </Text>
      </HStack>
      <Text
        modifiers={[
          font({ size: props.streakSize ?? 34, weight: 'semibold' }),
          ...color(props.text),
        ]}
      >
        {props.streak ?? '0'}
      </Text>
      <Text modifiers={[font({ size: props.labelSize ?? 13 }), ...color(props.text)]}>
        {props.streakLabel ?? 'Start a clean streak'}
      </Text>
      <Text modifiers={[font({ size: props.lastSize ?? 11 }), ...color(props.textMuted)]}>
        {props.lastLine ?? 'Tap to drive'}
      </Text>
    </VStack>
  );
}

export const DriveWidget = createWidget<Partial<DriveWidgetProps>>(
  DRIVE_WIDGET_NAME,
  DriveWidgetLayout,
);
