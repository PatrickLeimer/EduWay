/**
 * Android home-screen widget (react-native-android-widget): a teal tile on its
 * lip with "Drive", the clean-drive streak and the last score. Tapping anywhere
 * opens eduway://drive/start (trip/driveLink.ts). Lexend is copied into the app
 * by the plugin (app.json `fonts`), so fonts.* work here.
 *
 * Load only after hasAndroidWidgets() (nativeWidgets.ts): importing the library
 * in Expo Go throws.
 */
import {
  FlexWidget,
  registerWidgetTaskHandler,
  requestWidgetUpdate,
  SvgWidget,
  TextWidget,
  type WidgetTaskHandler,
} from 'react-native-android-widget';

import { DRIVE_LINK_URL } from '../../trip';
import type { WidgetStats } from '../lib/widgetStats';
import { colors, font, fonts, lip, radius, space } from '../theme';
import { loadWidgetStats } from './widgetStatsStore';

/** Name in app.json (react-native-android-widget `widgets[].name`). */
const WIDGET_NAME = 'DriveWidget';
const ICON_SIZE = 20;

/** Steering wheel: rim, hub and three spokes. */
function steeringWheel(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round">
<circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="5" fill="${color}"/>
<path d="M5.5 21.5h13M29.5 21.5h13M24 29v13"/></svg>`;
}

function DriveWidget({ stats }: { stats: WidgetStats }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: DRIVE_LINK_URL }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: colors.primary,
        borderRadius: radius.xl,
        borderBottomWidth: lip.rest,
        borderBottomColor: colors.primaryLip,
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.md,
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: space.xs }}>
        <SvgWidget
          svg={steeringWheel(colors.onColor)}
          style={{ height: ICON_SIZE, width: ICON_SIZE }}
        />
        <TextWidget
          text="Drive"
          style={{ fontFamily: fonts.semiBold, fontSize: font.body, color: colors.onColor }}
        />
      </FlexWidget>
      <TextWidget
        text={String(stats.streak)}
        style={{ fontFamily: fonts.semiBold, fontSize: font.display, color: colors.onColor }}
      />
      <TextWidget
        text={stats.streakLabel}
        maxLines={1}
        style={{ fontFamily: fonts.regular, fontSize: font.small, color: colors.onColor }}
      />
      <TextWidget
        text={stats.lastLine}
        maxLines={1}
        style={{ fontFamily: fonts.regular, fontSize: font.tiny, color: colors.teal100 }}
      />
    </FlexWidget>
  );
}

/** Draws the tile whenever Android asks, from the stats the app last saved. */
const taskHandler: WidgetTaskHandler = async ({ widgetAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED') return;
  renderWidget(<DriveWidget stats={loadWidgetStats()} />);
};

export function registerAndroidDriveWidget(): void {
  registerWidgetTaskHandler(taskHandler);
}

/** Redraws every placed Drive widget with new stats. */
export function updateAndroidDriveWidget(stats: WidgetStats): Promise<void> {
  return requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () => <DriveWidget stats={stats} />,
  });
}
