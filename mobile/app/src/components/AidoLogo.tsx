import { Image, StyleSheet, Text, View } from 'react-native';

import { fonts, palette } from '../theme';

const appIcon = require('../../assets/icon.png');
const brandLogo = require('../../assets/aido-logo.png');

type AidoLogoProps = {
  compact?: boolean;
  splash?: boolean;
};

export function AidoLogo({ compact = false, splash = false }: AidoLogoProps) {
  if (splash) {
    return (
      <View style={styles.splash}>
        <Image resizeMode="contain" source={brandLogo} style={styles.splashImage} />
        <Text style={styles.splashText}>AI Wedding Planning OS</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Image resizeMode="contain" source={compact ? brandLogo : appIcon} style={compact ? styles.brandCompact : styles.logo} />
      {!compact && (
        <View>
          <Text style={styles.name}>A.I Do</Text>
          <Text style={styles.caption}>Wedding planner</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    alignItems: 'center',
    backgroundColor: palette.cream,
    flex: 1,
    justifyContent: 'center',
  },
  splashImage: {
    height: 230,
    width: 230,
  },
  splashText: {
    color: palette.wine,
    fontFamily: fonts.medium,
    fontSize: 13,
    letterSpacing: 1.5,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  logo: {
    borderRadius: 18,
    height: 52,
    width: 52,
  },
  logoCompact: {
    borderRadius: 14,
    height: 42,
    width: 42,
  },
  brandCompact: {
    height: 48,
    width: 78,
  },
  name: {
    color: palette.wine,
    fontFamily: fonts.headingSemi,
    fontSize: 22,
    lineHeight: 25,
  },
  caption: {
    color: palette.muted,
    fontFamily: fonts.medium,
    fontSize: 11,
    textTransform: 'uppercase',
  },
});
