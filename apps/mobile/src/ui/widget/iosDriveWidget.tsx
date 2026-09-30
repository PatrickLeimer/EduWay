/**
 * iPhone home-screen widget (expo-widgets): a teal tile that opens
 * eduway://drive/start (trip/driveLink.ts). Loaded only through
 * syncDriveWidget.ts, because Expo Go has no widget module.
 *
 * The 'widget' function runs in an isolated runtime inside the widget
 * extension: only @expo/ui/swift-ui components and modifiers, no imports or
 * module constants. So theme colors, text and the URL arrive as props from
 * syncDriveWidget.ts, and the font is the system font (Lexend is not bundled
 * into the extension). The system rounds and clips the tile, so there is no lip.
 */
import { Image, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

/** Name in app.json (expo-widgets plugin `widgets[].name`). */
export const DRIVE_WIDGET_NAME = 'DriveWidget';

export interface DriveWidgetProps {
  url: string;
  title: string;
  brand: string;
  background: string;
  text: string;
  textMuted: string;
  titleSize: number;
  brandSize: number;
}

function DriveWidgetLayout(props: Partial<DriveWidgetProps>) {
  'widget';
  // Until the app has run once there are no props; the tile still opens the drive link.
  return (
    <VStack
      spacing={6}
      modifiers={[
        widgetURL(props.url ?? 'eduway://drive/start'),
        ...(props.background ? [containerBackground(props.background, 'widget')] : []),
      ]}
    >
      <Image systemName="steeringwheel" size={44} color={props.text} />
      <Text
        modifiers={[
          font({ size: props.titleSize ?? 22, weight: 'semibold' }),
          ...(props.text ? [foregroundStyle(props.text)] : []),
        ]}
      >
        {props.title ?? 'Drive'}
      </Text>
      <Text
        modifiers={[
          font({ size: props.brandSize ?? 13 }),
          ...(props.textMuted ? [foregroundStyle(props.textMuted)] : []),
        ]}
      >
        {props.brand ?? 'EduWay'}
      </Text>
    </VStack>
  );
}

export const DriveWidget = createWidget<Partial<DriveWidgetProps>>(
  DRIVE_WIDGET_NAME,
  DriveWidgetLayout,
);
