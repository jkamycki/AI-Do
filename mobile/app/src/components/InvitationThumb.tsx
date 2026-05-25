import { StyleSheet, Text, View } from 'react-native';

import { fonts, radii, useAppTheme } from '../theme';
import { Guest } from '../types';

type InvitationThumbProps = {
  styleName: Guest['invitationStyle'];
};

export function InvitationThumb({ styleName }: InvitationThumbProps) {
  const { colors } = useAppTheme();
  const isBrown = styleName === 'brown';

  return (
    <View
      style={[
        styles.thumb,
        {
          backgroundColor: isBrown ? colors.text : styleName === 'floral' ? colors.backgroundAlt : colors.cardStrong,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.script, { color: isBrown ? colors.cardStrong : colors.accent }]}>Save</Text>
      <Text style={[styles.date, { color: isBrown ? colors.cardStrong : colors.primary }]}>Date</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 74,
    justifyContent: 'center',
    width: 58,
  },
  script: {
    fontFamily: fonts.headingSemi,
    fontSize: 15,
    lineHeight: 17,
  },
  date: {
    fontFamily: fonts.headingSemi,
    fontSize: 16,
    lineHeight: 18,
  },
});
