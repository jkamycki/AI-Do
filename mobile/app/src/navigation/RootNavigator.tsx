import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '../components/AppHeader';
import { AriaScreen } from '../screens/AriaScreen';
import { BudgetScreen } from '../screens/BudgetScreen';
import { ChecklistScreen } from '../screens/ChecklistScreen';
import { ContractsScreen } from '../screens/ContractsScreen';
import { DayOfScreen } from '../screens/DayOfScreen';
import { FilesScreen } from '../screens/FilesScreen';
import { GuestsScreen } from '../screens/GuestsScreen';
import { HelpScreen } from '../screens/HelpScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HotelsScreen } from '../screens/HotelsScreen';
import { InvitationsScreen } from '../screens/InvitationsScreen';
import { MoodBoardScreen } from '../screens/MoodBoardScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProfileSettingsScreen } from '../screens/ProfileSettingsScreen';
import { SeatingChartScreen } from '../screens/SeatingChartScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TimelineScreen } from '../screens/TimelineScreen';
import { UpdatesScreen } from '../screens/UpdatesScreen';
import { WebPortalScreen } from '../screens/WebPortalScreen';
import { VendorsScreen } from '../screens/VendorsScreen';
import { WebsiteEditorScreen } from '../screens/WebsiteEditorScreen';
import { WeddingPartyScreen } from '../screens/WeddingPartyScreen';
import { WorkspaceScreen } from '../screens/WorkspaceScreen';
import { fonts, radii, shadow, spacing, useAppTheme } from '../theme';

export type RootStackParamList = {
  Aria: undefined;
  Contracts: undefined;
  DayOf: undefined;
  MainTabs: undefined;
  Files: undefined;
  Help: undefined;
  Hotels: undefined;
  Invitations: undefined;
  MoodBoard: undefined;
  Onboarding: undefined;
  ProfileSettings: undefined;
  SeatingChart: undefined;
  Settings: undefined;
  Timeline: undefined;
  Updates: undefined;
  WebPortal: undefined;
  WebsiteEditor: undefined;
  WeddingParty: undefined;
  Workspace: undefined;
};

export type TabParamList = {
  Home: undefined;
  Vendors: undefined;
  Budget: undefined;
  Checklist: undefined;
  Guests: undefined;
  More: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function HeaderBridge() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return <AppHeader onProfilePress={() => navigation.navigate('ProfileSettings')} />;
}

function TabIcon({ color, focused, routeName }: { color: string; focused: boolean; routeName: keyof TabParamList }) {
  const { colors } = useAppTheme();
  const iconColor = focused ? colors.primary : color;
  const wrapStyle = focused ? [styles.iconWrap, { backgroundColor: colors.primarySoft }] : styles.iconWrap;

  if (routeName === 'Home') {
    return (
      <View style={wrapStyle}>
        <Ionicons color={iconColor} name={focused ? 'home' : 'home-outline'} size={22} />
      </View>
    );
  }

  if (routeName === 'Vendors') {
    return (
      <View style={wrapStyle}>
        <MaterialCommunityIcons color={iconColor} name={focused ? 'storefront' : 'storefront-outline'} size={22} />
      </View>
    );
  }

  if (routeName === 'Budget') {
    return (
      <View style={wrapStyle}>
        <MaterialCommunityIcons color={iconColor} name={focused ? 'cash-multiple' : 'cash'} size={23} />
      </View>
    );
  }

  if (routeName === 'Checklist') {
    return (
      <View style={wrapStyle}>
        <Ionicons color={iconColor} name={focused ? 'checkbox' : 'checkbox-outline'} size={22} />
      </View>
    );
  }

  if (routeName === 'Guests') {
    return (
      <View style={wrapStyle}>
        <Ionicons color={iconColor} name={focused ? 'people' : 'people-outline'} size={23} />
      </View>
    );
  }

  return (
    <View style={wrapStyle}>
      <Ionicons color={iconColor} name="ellipsis-horizontal" size={23} />
    </View>
  );
}

function MainTabs() {
  const { colors } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: HeaderBridge,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} routeName={route.name} />,
        tabBarLabelStyle: {
          fontFamily: fonts.semibold,
          fontSize: 10,
          marginTop: 0,
        },
        tabBarStyle: {
          ...shadow,
          backgroundColor: colors.cardStrong,
          borderRadius: radii.xl,
          borderTopWidth: 0,
          bottom: 12,
          elevation: 12,
          height: 76,
          left: 12,
          paddingBottom: 10,
          paddingTop: 8,
          position: 'absolute',
          right: 12,
          shadowColor: colors.shadow,
        },
      })}
    >
      <Tab.Screen component={HomeScreen} name="Home" />
      <Tab.Screen component={VendorsScreen} name="Vendors" />
      <Tab.Screen component={BudgetScreen} name="Budget" />
      <Tab.Screen component={ChecklistScreen} name="Checklist" />
      <Tab.Screen component={GuestsScreen} name="Guests" />
      <Tab.Screen component={MoreScreen} name="More" />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        header: HeaderBridge,
      }}
    >
      <Stack.Screen component={MainTabs} name="MainTabs" options={{ headerShown: false }} />
      <Stack.Screen component={ProfileSettingsScreen} name="ProfileSettings" options={{ title: 'Profile' }} />
      <Stack.Screen component={SettingsScreen} name="Settings" options={{ title: 'Settings' }} />
      <Stack.Screen component={OnboardingScreen} name="Onboarding" options={{ title: 'Setup' }} />
      <Stack.Screen component={MoodBoardScreen} name="MoodBoard" options={{ title: 'Mood Board' }} />
      <Stack.Screen component={TimelineScreen} name="Timeline" options={{ title: 'Timeline' }} />
      <Stack.Screen component={FilesScreen} name="Files" options={{ title: 'Files' }} />
      <Stack.Screen component={ContractsScreen} name="Contracts" options={{ title: 'Contracts' }} />
      <Stack.Screen component={WeddingPartyScreen} name="WeddingParty" options={{ title: 'Wedding Party' }} />
      <Stack.Screen component={SeatingChartScreen} name="SeatingChart" options={{ title: 'Seating Chart' }} />
      <Stack.Screen component={HotelsScreen} name="Hotels" options={{ title: 'Hotels' }} />
      <Stack.Screen component={AriaScreen} name="Aria" options={{ title: 'Aria' }} />
      <Stack.Screen component={DayOfScreen} name="DayOf" options={{ title: 'Day Of' }} />
      <Stack.Screen component={WebsiteEditorScreen} name="WebsiteEditor" options={{ title: 'Website Editor' }} />
      <Stack.Screen component={InvitationsScreen} name="Invitations" options={{ title: 'Invitations' }} />
      <Stack.Screen component={WorkspaceScreen} name="Workspace" options={{ title: 'Workspace' }} />
      <Stack.Screen component={HelpScreen} name="Help" options={{ title: 'Help' }} />
      <Stack.Screen component={UpdatesScreen} name="Updates" options={{ title: 'Updates' }} />
      <Stack.Screen component={WebPortalScreen} name="WebPortal" options={{ title: 'Website Portal' }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 34,
    justifyContent: 'center',
    width: 42,
  },
});
