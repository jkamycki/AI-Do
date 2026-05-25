import { Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { fonts, spacing, useAppTheme } from '../theme';

const PORTAL_URL = 'https://aidowedding.net/dashboard';

export function WebPortalScreen() {
  const { colors } = useAppTheme();

  return (
    <Screen contentStyle={styles.content}>
      <SectionHeader subtitle="Use this when a website-only workflow is not native in the app yet." title="Website Portal" />
      <Card style={styles.notice}>
        <Text style={[styles.noticeText, { color: colors.muted }]}>
          Native screens should handle everyday planning. The portal keeps the full website available for account, publishing, and advanced workflows.
        </Text>
      </Card>
      <View style={[styles.webWrap, { borderColor: colors.border }]}>
        <WebView
          originWhitelist={['https://*']}
          setSupportMultipleWindows={false}
          source={{ uri: PORTAL_URL }}
          startInLoadingState
          onShouldStartLoadWithRequest={(request) => {
            const isAido = request.url.startsWith('https://aidowedding.net') || request.url.startsWith('https://www.aidowedding.net');
            if (isAido) {
              return true;
            }
            void Linking.openURL(request.url);
            return false;
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 48,
  },
  notice: {
    marginBottom: spacing.md,
  },
  noticeText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  webWrap: {
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    minHeight: 620,
    overflow: 'hidden',
  },
});
