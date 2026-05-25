import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View } from 'react-native';

import { fonts, radii, shadow, spacing, useAppTheme } from '../theme';

type SearchBarProps = {
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
};

export function SearchBar({ onChangeText, placeholder, value }: SearchBarProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.cardStrong,
          borderColor: colors.border,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <Ionicons color={colors.muted} name="search" size={22} />
      <TextInput
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.text }]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...shadow,
    alignItems: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
  },
});
