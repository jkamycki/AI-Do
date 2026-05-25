import { KeyboardTypeOptions, StyleSheet, Text, TextInput, View } from 'react-native';

import { fonts, radii, spacing, useAppTheme } from '../theme';

type FormFieldProps = {
  keyboardType?: KeyboardTypeOptions;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
};

export function FormField({ keyboardType, label, multiline = false, onChangeText, placeholder, value }: FormFieldProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  multiline: {
    minHeight: 92,
    paddingTop: spacing.md,
  },
});
