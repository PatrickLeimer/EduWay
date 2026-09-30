/**
 * Android home-screen widget (react-native-android-widget): a teal tile on
 * its lip that opens eduway://drive/start (trip/driveLink.ts). Rendered by the
 * widget task handler registered in index.ts, outside the app screens. Lexend
 * is copied into the app by the plugin (app.json `fonts`), so fonts.* work here.
 */
import {
  FlexWidget,
  SvgWidget,
  TextWidget,
  type WidgetTaskHandler,
} from 'react-native-android-widget';

import { DRIVE_LINK_URL } from '../../trip';
import { colors, font, fonts, lip, radius, space } from '../theme';

const ICON_SIZE = 44;

/** Steering wheel: rim, hub and three spokes. */
function steeringWheel(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round">
<circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="5" fill="${color}"/>
<path d="M5.5 21.5h13M29.5 21.5h13M24 29v13"/></svg>`;
}

export function AndroidDriveWidget() {
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
        flexGap: space.xs,
      }}
    >
      <SvgWidget
        svg={steeringWheel(colors.onColor)}
        style={{ height: ICON_SIZE, width: ICON_SIZE }}
      />
      <TextWidget
        text="Drive"
        style={{ fontFamily: fonts.semiBold, fontSize: font.title, color: colors.onColor }}
      />
      <TextWidget
        text="EduWay"
        style={{ fontFamily: fonts.regular, fontSize: font.small, color: colors.teal100 }}
      />
    </FlexWidget>
  );
}

/** Draws the tile whenever Android asks; taps are handled natively (OPEN_URI). */
export const driveWidgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED') return;
  renderWidget(<AndroidDriveWidget />);
};
