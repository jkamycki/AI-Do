package net.aidowedding.app;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://aidowedding.net/";
    private static final String VENDORS_URL = "https://aidowedding.net/vendors";
    private static final String ADD_URL = "https://aidowedding.net/aria";
    private static final String CHECKLIST_URL = "https://aidowedding.net/checklist";
    private static final String MORE_URL = "https://aidowedding.net/settings";
    private static final String INTERNAL_HOST = "aidowedding.net";

    private static final int WHITE = Color.WHITE;
    private static final int BLUSH = Color.rgb(247, 221, 226);
    private static final int GOLD = Color.rgb(212, 163, 115);
    private static final int INK = Color.rgb(52, 37, 43);
    private static final int MUTED = Color.rgb(112, 97, 103);
    private static final int WINE = Color.rgb(141, 61, 88);
    private static final int ROSE = Color.rgb(222, 145, 169);
    private static final int IVORY = Color.rgb(255, 250, 246);
    private static final int CREAM = Color.rgb(255, 247, 242);
    private static final int PETAL = Color.rgb(255, 238, 242);
    private static final int CARD_TINT = Color.rgb(255, 252, 250);

    private WebView webView;
    private ScrollView homeOverlay;
    private ScrollView sectionOverlay;
    private LinearLayout sectionContent;
    private FrameLayout root;
    private View splash;
    private NativeTabButton homeTab;
    private NativeTabButton vendorsTab;
    private NativeTabButton checklistTab;
    private NativeTabButton moreTab;
    private FloatingActionButton addButton;
    private String activeUrl = HOME_URL;
    private String currentNativeScreen = "home";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setStatusBarColor(WHITE);
        window.setNavigationBarColor(WHITE);

        root = new FrameLayout(this);
        root.setBackgroundColor(WHITE);

        webView = new WebView(this);
        configureWebView();
        webView.setVisibility(View.GONE);
        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(-1, -1);
        webParams.topMargin = dp(100);
        webParams.bottomMargin = dp(116);
        root.addView(webView, webParams);

        homeOverlay = createHomeOverlay();
        FrameLayout.LayoutParams homeParams = new FrameLayout.LayoutParams(-1, -1);
        homeParams.topMargin = dp(100);
        homeParams.bottomMargin = dp(110);
        root.addView(homeOverlay, homeParams);

        sectionOverlay = createSectionOverlay();
        sectionOverlay.setVisibility(View.GONE);
        sectionOverlay.setAlpha(0f);
        FrameLayout.LayoutParams sectionParams = new FrameLayout.LayoutParams(-1, -1);
        sectionParams.topMargin = dp(100);
        sectionParams.bottomMargin = dp(110);
        root.addView(sectionOverlay, sectionParams);

        View topBar = createTopBar();
        topBar.setElevation(dp(24));
        root.addView(topBar, new FrameLayout.LayoutParams(-1, dp(100), Gravity.TOP));

        FrameLayout bottomWrap = new FrameLayout(this);
        bottomWrap.setPadding(dp(14), dp(4), dp(14), dp(14));
        bottomWrap.setBackgroundColor(Color.TRANSPARENT);
        bottomWrap.setElevation(dp(28));
        bottomWrap.addView(createBottomBar(), new FrameLayout.LayoutParams(-1, dp(76), Gravity.BOTTOM));
        addButton = new FloatingActionButton(this);
        FrameLayout.LayoutParams addParams = new FrameLayout.LayoutParams(dp(62), dp(62), Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        addParams.topMargin = 0;
        bottomWrap.addView(addButton, addParams);
        root.addView(bottomWrap, new FrameLayout.LayoutParams(-1, dp(108), Gravity.BOTTOM));

        splash = createSplash();
        root.addView(splash, new FrameLayout.LayoutParams(-1, -1));

        setContentView(root);
        updateActiveTab(HOME_URL);
        webView.loadUrl(HOME_URL);
        splash.animate().alpha(1f).setDuration(260).withEndAction(() ->
            splash.animate().alpha(0f).setDuration(520).setStartDelay(650).setListener(new AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(Animator animation) {
                    root.removeView(splash);
                }
            }).start()
        ).start();
    }

    private View createTopBar() {
        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);
        wrapper.setBackground(gradientRounded(WHITE, Color.rgb(255, 250, 248), 0, Color.TRANSPARENT, 0));
        wrapper.setElevation(dp(4));

        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(18), dp(28), dp(18), dp(6));

        BrandLogoView logo = new BrandLogoView(this, true);
        bar.addView(logo, new LinearLayout.LayoutParams(dp(118), dp(46)));

        TextView spacer = new TextView(this);
        bar.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));

        ProfileIcon profileIcon = new ProfileIcon(this);
        profileIcon.setClickable(true);
        profileIcon.setOnClickListener(v -> showNativeSection("more"));
        bar.addView(profileIcon, new LinearLayout.LayoutParams(dp(42), dp(42)));

        wrapper.addView(bar, new LinearLayout.LayoutParams(-1, 0, 1f));
        View accent = new View(this);
        accent.setBackgroundColor(Color.rgb(230, 183, 196));
        wrapper.addView(accent, new LinearLayout.LayoutParams(-1, dp(2)));
        return wrapper;
    }

    private ScrollView createHomeOverlay() {
        ScrollView scrollView = new WeddingBackdropScrollView(this);
        scrollView.setFillViewport(false);
        scrollView.setBackgroundColor(Color.rgb(255, 247, 248));
        scrollView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(20), dp(22), dp(20), dp(190));
        scrollView.addView(content, new ScrollView.LayoutParams(-1, -2));

        content.addView(homeHeroCard(), new LinearLayout.LayoutParams(-1, -2));

        LinearLayout search = new LinearLayout(this);
        search.setGravity(Gravity.CENTER_VERTICAL);
        search.setPadding(dp(18), 0, dp(14), 0);
        search.setBackground(gradientRounded(WHITE, CARD_TINT, dp(24), Color.argb(120, 247, 221, 226), dp(1)));
        search.setElevation(dp(7));
        search.setClickable(true);
        search.setOnClickListener(v -> showNativeSection("search"));
        TextView welcome = new TextView(this);
        welcome.setText("Find guests, vendors, tasks...");
        welcome.setTextColor(Color.rgb(139, 111, 120));
        welcome.setTextSize(14);
        search.addView(welcome, new LinearLayout.LayoutParams(0, -1, 1f));
        SearchIcon searchIcon = new SearchIcon(this);
        search.addView(searchIcon, new LinearLayout.LayoutParams(dp(30), dp(30)));
        LinearLayout.LayoutParams searchParams = new LinearLayout.LayoutParams(-1, dp(52));
        searchParams.topMargin = dp(16);
        searchParams.bottomMargin = dp(18);
        content.addView(search, searchParams);

        content.addView(sectionLabel("Planning tools"), new LinearLayout.LayoutParams(-1, -2));

        LinearLayout firstRow = shortcutRow();
        firstRow.addView(new ShortcutCard(this, "Wedding\nProfile", MiniIcon.HEART, () -> showNativeSection("profile")), shortcutParams());
        firstRow.addView(new ShortcutCard(this, "Mood\nBoard", MiniIcon.IMAGE, () -> showNativeSection("mood")), shortcutParams());
        firstRow.addView(new ShortcutCard(this, "Timeline", MiniIcon.TIMELINE, () -> showNativeSection("timeline")), shortcutParams());
        content.addView(firstRow, new LinearLayout.LayoutParams(-1, dp(120)));

        LinearLayout secondRow = shortcutRow();
        secondRow.addView(new ShortcutCard(this, "Checklist", MiniIcon.CALENDAR, () -> showNativeSection("checklist")), shortcutParams());
        secondRow.addView(new ShortcutCard(this, "Guest\nList", MiniIcon.CHECK, () -> showNativeSection("guests")), shortcutParams());
        secondRow.addView(new ShortcutCard(this, "Budget", MiniIcon.BUDGET, () -> showNativeSection("budget")), shortcutParams());
        LinearLayout.LayoutParams secondRowParams = new LinearLayout.LayoutParams(-1, dp(120));
        secondRowParams.bottomMargin = dp(18);
        content.addView(secondRow, secondRowParams);

        content.addView(vendorTrackingCard(), new LinearLayout.LayoutParams(-1, -2));
        LinearLayout.LayoutParams taskParams = new LinearLayout.LayoutParams(-1, -2);
        taskParams.topMargin = dp(16);
        content.addView(taskCard(), taskParams);
        TextView scrollEnd = new TextView(this);
        scrollEnd.setText("");
        content.addView(scrollEnd, new LinearLayout.LayoutParams(-1, dp(28)));
        return scrollView;
    }

    private ScrollView createSectionOverlay() {
        ScrollView scrollView = new WeddingBackdropScrollView(this);
        scrollView.setFillViewport(false);
        scrollView.setBackgroundColor(Color.rgb(255, 247, 248));
        scrollView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        sectionContent = new LinearLayout(this);
        sectionContent.setOrientation(LinearLayout.VERTICAL);
        sectionContent.setPadding(dp(20), dp(24), dp(20), dp(190));
        scrollView.addView(sectionContent, new ScrollView.LayoutParams(-1, -2));
        return scrollView;
    }

    private void showNativeSection(String section) {
        if ("home".equals(section)) {
            currentNativeScreen = "home";
            if (sectionOverlay != null) {
                sectionOverlay.setVisibility(View.GONE);
                sectionOverlay.setAlpha(0f);
            }
            webView.setVisibility(View.GONE);
            setHomeOverlayVisible(true);
            activeUrl = HOME_URL;
            updateActiveTab(HOME_URL);
            return;
        }
        currentNativeScreen = section;
        setHomeOverlayVisible(false);
        webView.setVisibility(View.GONE);
        sectionOverlay.setVisibility(View.VISIBLE);
        sectionOverlay.animate().alpha(1f).setDuration(180).start();
        sectionContent.removeAllViews();

        if ("vendors".equals(section)) {
            activeUrl = VENDORS_URL;
            updateActiveTab(VENDORS_URL);
            buildVendorsSection();
        } else if ("checklist".equals(section)) {
            activeUrl = CHECKLIST_URL;
            updateActiveTab(CHECKLIST_URL);
            buildChecklistSection();
        } else if ("aria".equals(section)) {
            activeUrl = ADD_URL;
            updateActiveTab(ADD_URL);
            buildAriaSection();
        } else if ("search".equals(section)) {
            activeUrl = HOME_URL;
            updateActiveTab(HOME_URL);
            buildSearchSection();
        } else if ("profile".equals(section)) {
            activeUrl = "https://aidowedding.net/profile";
            updateActiveTab(activeUrl);
            buildProfileSection();
        } else if ("mood".equals(section)) {
            activeUrl = "https://aidowedding.net/mood-board";
            updateActiveTab(activeUrl);
            buildMoodSection();
        } else if ("timeline".equals(section)) {
            activeUrl = "https://aidowedding.net/timeline";
            updateActiveTab(activeUrl);
            buildTimelineSection();
        } else if ("guests".equals(section)) {
            activeUrl = "https://aidowedding.net/guests";
            updateActiveTab(activeUrl);
            buildGuestsSection();
        } else if ("budget".equals(section)) {
            activeUrl = "https://aidowedding.net/budget";
            updateActiveTab(activeUrl);
            buildBudgetSection();
        } else if ("files".equals(section)) {
            activeUrl = "https://aidowedding.net/documents";
            updateActiveTab(activeUrl);
            buildFilesSection();
        } else if ("settings".equals(section)) {
            activeUrl = MORE_URL;
            updateActiveTab(MORE_URL);
            buildSettingsSection();
        } else if ("website".equals(section)) {
            activeUrl = "https://aidowedding.net/website";
            updateActiveTab(activeUrl);
            buildWebsiteSection();
        } else if ("vendor-lilys".equals(section)) {
            activeUrl = VENDORS_URL;
            updateActiveTab(VENDORS_URL);
            buildVendorDetailSection("Lily's Blooms", "Florist", "$750.00", "Payment due in 2 weeks", "Contract signed", "Send final flower palette");
        } else if ("vendor-venue".equals(section)) {
            activeUrl = VENDORS_URL;
            updateActiveTab(VENDORS_URL);
            buildVendorDetailSection("Amazing Manor", "Venue", "$3,200.00", "Tour notes ready", "Proposal received", "Confirm guest capacity");
        } else if ("vendor-photo".equals(section)) {
            activeUrl = VENDORS_URL;
            updateActiveTab(VENDORS_URL);
            buildVendorDetailSection("Golden Hour Photo", "Photography", "$1,100.00", "Contract review pending", "Reviewing", "Choose engagement session date");
        } else if ("task-venue".equals(section)) {
            activeUrl = CHECKLIST_URL;
            updateActiveTab(CHECKLIST_URL);
            buildTaskDetailSection("Venue tour w/ Amazing Manor", "Walk the space, confirm rain plan, and take layout photos.", "Vendors", "vendor-venue");
        } else if ("task-photo".equals(section)) {
            activeUrl = CHECKLIST_URL;
            updateActiveTab(CHECKLIST_URL);
            buildTaskDetailSection("Confirm photographer", "Review package, add must-have shot list, and approve the contract.", "Vendors", "vendor-photo");
        } else if ("task-guests".equals(section)) {
            activeUrl = CHECKLIST_URL;
            updateActiveTab(CHECKLIST_URL);
            buildTaskDetailSection("Final guest list due", "Lock the headcount before invitations and catering estimates.", "Guest List", "guests");
        } else if ("offline".equals(section)) {
            buildOfflineSection();
        } else {
            activeUrl = MORE_URL;
            updateActiveTab(MORE_URL);
            buildMoreSection();
        }
    }

    private void buildVendorsSection() {
        sectionHeader("Vendors", "Track bookings, balances, and next steps.");
        sectionContent.addView(workflowCard("Vendor workflow", "Compare quotes, book the team, track contracts, and keep payments visible.", "3 active vendors", "1 payment due"), spacedParams(dp(8)));
        sectionContent.addView(vendorRow("Lily's Blooms", "Florist", "$750.00", "Payment due in 2 weeks", true, "vendor-lilys"), spacedParams(dp(12)));
        sectionContent.addView(vendorRow("Amazing Manor", "Venue", "$3,200.00", "Tour notes ready", false, "vendor-venue"), spacedParams(dp(12)));
        sectionContent.addView(vendorRow("Golden Hour Photo", "Photography", "$1,100.00", "Contract review pending", false, "vendor-photo"), spacedParams(dp(12)));
    }

    private void buildChecklistSection() {
        sectionHeader("Planning", "Progress");
        sectionContent.addView(progressCard());
        sectionContent.addView(taskCard(), spacedParams(dp(16)));
        sectionContent.addView(workflowStep("Review budget after venue quote", "Keeps your floral and photo numbers realistic.", false, "budget"), spacedParams(dp(12)));
        sectionContent.addView(workflowStep("Send guest count to venue", "Use RSVP totals when the first invite batch is ready.", false, "guests"), spacedParams(dp(10)));
    }

    private void buildMoreSection() {
        sectionHeader("More", "Account, files, website, and settings.");
        sectionContent.addView(nativeMenuCard("Guest List", "Manage RSVPs and invitations", "guests"), spacedParams(dp(12)));
        sectionContent.addView(nativeMenuCard("Budget", "Track totals and payments", "budget"), spacedParams(dp(12)));
        sectionContent.addView(nativeMenuCard("Files", "Contracts, invoices, and docs", "files"), spacedParams(dp(12)));
        sectionContent.addView(nativeMenuCard("Wedding Website", "Preview pages and share details", "website"), spacedParams(dp(12)));
        sectionContent.addView(nativeMenuCard("Settings", "Workspace and account details", "settings"), spacedParams(dp(12)));
    }

    private void buildAriaSection() {
        sectionHeader("Ask Aria", "Fast help for the next thing on your list.");
        sectionContent.addView(workflowCard("Suggested prompt", "Draft a kind follow-up asking Lily's Blooms to confirm peony availability and final payment timing.", "Vendor email", "Ready"), spacedParams(dp(8)));
        sectionContent.addView(nativeActionCard("Build my checklist", "Review the tasks already organized by timing and priority.", "Open checklist", "checklist"), spacedParams(dp(12)));
        sectionContent.addView(nativeActionCard("Review a contract", "Keep vendor contracts and invoices in one easy place.", "Open files", "files"), spacedParams(dp(12)));
        sectionContent.addView(actionCard("Open full Aria assistant", "Use the live web assistant for custom planning requests.", "Open Aria", ADD_URL), spacedParams(dp(12)));
    }

    private void buildSearchSection() {
        sectionHeader("Find Anything", "Jump straight to the planning tool you need.");
        sectionContent.addView(nativeMenuCard("Vendors", "Florists, venues, photographers, and payments", "vendors"), spacedParams(dp(12)));
        sectionContent.addView(nativeMenuCard("Checklist", "Upcoming tasks and progress", "checklist"), spacedParams(dp(12)));
        sectionContent.addView(nativeMenuCard("Mood Board", "Colors, images, and style direction", "mood"), spacedParams(dp(12)));
        sectionContent.addView(nativeMenuCard("Aria Assistant", "Ask for help, drafts, and planning suggestions", "aria"), spacedParams(dp(12)));
    }

    private void buildProfileSection() {
        sectionHeader("Wedding Profile", "Core wedding details at a glance.");
        sectionContent.addView(infoCard("Couple", "Stacy & Rick", "Personalize names, date, venue, and guest count."), spacedParams(dp(12)));
        sectionContent.addView(infoCard("Wedding Date", "Thursday, July 24, 2036", "3714 days to go."), spacedParams(dp(12)));
        sectionContent.addView(nativeActionCard("Next best step", "Confirm venue, guest count, and ceremony time before sending invitations.", "Open guests", "guests"), spacedParams(dp(12)));
    }

    private void buildMoodSection() {
        sectionHeader("Mood Board", "Keep the wedding style easy to scan.");
        sectionContent.addView(infoCard("Palette", "Blush, ivory, gold", "A soft romantic direction for florals, decor, and stationery."), spacedParams(dp(12)));
        sectionContent.addView(infoCard("Inspiration", "Garden romance", "Collect venue photos, floral references, dress ideas, and table settings."), spacedParams(dp(12)));
        sectionContent.addView(nativeActionCard("Share with florist", "Use the palette and notes when you message Lily's Blooms.", "Open vendor", "vendor-lilys"), spacedParams(dp(12)));
    }

    private void buildTimelineSection() {
        sectionHeader("Timeline", "A calm view of the wedding day.");
        sectionContent.addView(infoCard("Ceremony", "5:00 PM", "Chateau LaMer ceremony space."), spacedParams(dp(12)));
        sectionContent.addView(infoCard("Reception", "7:00 PM", "Dinner, speeches, and dancing."), spacedParams(dp(12)));
        sectionContent.addView(nativeActionCard("Next timeline step", "Send the ceremony and reception timing to vendors.", "Open vendors", "vendors"), spacedParams(dp(12)));
    }

    private void buildGuestsSection() {
        sectionHeader("Guest List", "RSVP and invitation status.");
        sectionContent.addView(infoCard("Expected guests", "200", "Keep households, plus-ones, and meal choices organized."), spacedParams(dp(12)));
        sectionContent.addView(infoCard("RSVP Status", "Ready to send", "Track who is attending, declining, or still pending."), spacedParams(dp(12)));
        sectionContent.addView(workflowStep("Collect mailing addresses", "Ask family for missing addresses before invitations go out.", false, "aria"), spacedParams(dp(12)));
        sectionContent.addView(workflowStep("Confirm plus-ones", "Keeps venue count and budget numbers aligned.", false, "budget"), spacedParams(dp(10)));
    }

    private void buildBudgetSection() {
        sectionHeader("Budget", "Costs, payments, and balances.");
        sectionContent.addView(infoCard("Spent", "$5,050", "Across venue, florals, and photography."), spacedParams(dp(12)));
        sectionContent.addView(infoCard("Next payment", "$750", "Lily's Blooms due in 2 weeks."), spacedParams(dp(12)));
        sectionContent.addView(workflowStep("Venue deposit", "$3,200 scheduled after tour approval.", true, "vendor-venue"), spacedParams(dp(12)));
        sectionContent.addView(workflowStep("Florist balance", "$750 due in 2 weeks.", false, "vendor-lilys"), spacedParams(dp(10)));
        sectionContent.addView(workflowStep("Photo contract", "$1,100 pending contract review.", false, "vendor-photo"), spacedParams(dp(10)));
    }

    private void buildFilesSection() {
        sectionHeader("Files", "Contracts, invoices, and notes.");
        sectionContent.addView(workflowCard("Document inbox", "Keep vendor PDFs, invoices, and planning notes together before sending them to Aria.", "5 files", "2 need review"), spacedParams(dp(8)));
        sectionContent.addView(workflowStep("Florist invoice", "Payment amount and due date are ready for budget tracking.", true, "vendor-lilys"), spacedParams(dp(12)));
        sectionContent.addView(workflowStep("Photography contract", "Review cancellation terms and delivery timeline.", false, "vendor-photo"), spacedParams(dp(10)));
        sectionContent.addView(workflowStep("Venue proposal", "Confirm room block and guest capacity.", false, "vendor-venue"), spacedParams(dp(10)));
    }

    private void buildSettingsSection() {
        sectionHeader("Settings", "Workspace and account details.");
        sectionContent.addView(infoCard("Profile", "Stacy & Rick", "Wedding planning workspace for A.I Do."), spacedParams(dp(12)));
        sectionContent.addView(infoCard("Notifications", "Smart reminders on", "Payment, RSVP, and task reminders stay visible in the app."), spacedParams(dp(12)));
        sectionContent.addView(nativeActionCard("Need help?", "Use Aria to draft reminders, emails, and planning summaries.", "Ask Aria", "aria"), spacedParams(dp(12)));
    }

    private void buildWebsiteSection() {
        sectionHeader("Wedding Website", "Preview and share guest-facing details.");
        sectionContent.addView(infoCard("Status", "Draft", "Ceremony, reception, hotel, and RSVP sections are ready to review."), spacedParams(dp(12)));
        sectionContent.addView(workflowStep("Review hotel block", "Make sure guests see the Hilton Garden Inn booking details.", false, "profile"), spacedParams(dp(12)));
        sectionContent.addView(workflowStep("Add RSVP deadline", "Connect your guest list timeline to the website.", false, "guests"), spacedParams(dp(10)));
        sectionContent.addView(actionCard("Open website editor", "Use the full web editor when you are ready to publish.", "Open editor", "https://aidowedding.net/website"), spacedParams(dp(12)));
    }

    private void buildVendorDetailSection(String name, String type, String amount, String note, String status, String nextStep) {
        sectionHeader(name, type + " details");
        sectionContent.addView(infoCard("Balance", amount, note), spacedParams(dp(12)));
        sectionContent.addView(infoCard("Status", status, "Keep the contract, notes, and payment schedule together."), spacedParams(dp(12)));
        sectionContent.addView(workflowStep(nextStep, "Tap through related planning areas without leaving the native app.", false, "aria"), spacedParams(dp(12)));
        sectionContent.addView(nativeActionCard("Back to vendors", "Return to your vendor tracker.", "View vendors", "vendors"), spacedParams(dp(12)));
    }

    private void buildTaskDetailSection(String title, String body, String relatedLabel, String relatedSection) {
        sectionHeader(title, "Task details");
        sectionContent.addView(infoCard("What to do", title, body), spacedParams(dp(12)));
        sectionContent.addView(workflowStep("Prepare details", "Collect notes, prices, and questions before marking complete.", false, relatedSection), spacedParams(dp(12)));
        sectionContent.addView(nativeActionCard("Open " + relatedLabel, "Jump to the related planning section.", "Continue", relatedSection), spacedParams(dp(12)));
        sectionContent.addView(nativeActionCard("Back to checklist", "Return to planning progress.", "View checklist", "checklist"), spacedParams(dp(12)));
    }

    private void buildOfflineSection() {
        sectionHeader("Connection Issue", "The app could not load that web page.");
        sectionContent.addView(infoCard("Try again", "Check internet", "Your native dashboard still works. When the emulator internet is back, web pages will open again."), spacedParams(dp(12)));
        sectionContent.addView(actionCard("Back to Home", "Return to the native dashboard.", "Go home", HOME_URL), spacedParams(dp(12)));
    }

    private void sectionHeader(String title, String subtitle) {
        TextView heading = new TextView(this);
        heading.setText(title);
        heading.setTextColor(INK);
        heading.setTextSize(33);
        heading.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
        heading.setGravity(Gravity.CENTER);
        heading.setIncludeFontPadding(false);
        sectionContent.addView(heading, new LinearLayout.LayoutParams(-1, -2));

        TextView sub = new TextView(this);
        sub.setText(subtitle);
        sub.setTextColor(MUTED);
        sub.setTextSize(14);
        sub.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subParams = new LinearLayout.LayoutParams(-1, -2);
        subParams.topMargin = dp(8);
        subParams.bottomMargin = dp(10);
        sectionContent.addView(sub, subParams);

        View divider = new View(this);
        divider.setBackgroundColor(GOLD);
        LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(dp(82), dp(2));
        dividerParams.gravity = Gravity.CENTER_HORIZONTAL;
        dividerParams.bottomMargin = dp(20);
        sectionContent.addView(divider, dividerParams);
    }

    private LinearLayout.LayoutParams spacedParams(int top) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = top;
        return params;
    }

    private View homeHeroCard() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(16), dp(16), dp(14));
        card.setBackground(gradientRounded(WHITE, PETAL, dp(26), Color.argb(130, 247, 221, 226), dp(1)));
        card.setElevation(dp(9));
        card.setClickable(true);
        card.setOnClickListener(v -> showNativeSection("profile"));

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.addView(new CoupleAvatar(this), new LinearLayout.LayoutParams(dp(58), dp(58)));

        LinearLayout titleStack = new LinearLayout(this);
        titleStack.setOrientation(LinearLayout.VERTICAL);
        titleStack.setPadding(dp(14), 0, 0, 0);

        TextView greeting = new TextView(this);
        greeting.setText("Good morning,");
        greeting.setTextColor(MUTED);
        greeting.setTextSize(13);
        greeting.setIncludeFontPadding(false);
        titleStack.addView(greeting, new LinearLayout.LayoutParams(-1, -2));

        TextView names = new TextView(this);
        names.setText("Stacy & Rick");
        names.setTextColor(INK);
        names.setTextSize(26);
        names.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
        names.setIncludeFontPadding(false);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(-1, -2);
        nameParams.topMargin = dp(2);
        titleStack.addView(names, nameParams);

        TextView date = new TextView(this);
        date.setText("Thursday, July 24, 2036");
        date.setTextColor(MUTED);
        date.setTextSize(12);
        date.setIncludeFontPadding(false);
        LinearLayout.LayoutParams dateParams = new LinearLayout.LayoutParams(-1, -2);
        dateParams.topMargin = dp(5);
        titleStack.addView(date, dateParams);
        top.addView(titleStack, new LinearLayout.LayoutParams(0, -2, 1f));

        top.addView(new RingsAccentView(this), new LinearLayout.LayoutParams(dp(42), dp(42)));
        card.addView(top, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout statRow = new LinearLayout(this);
        statRow.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams statRowParams = new LinearLayout.LayoutParams(-1, -2);
        statRowParams.topMargin = dp(14);
        statRow.addView(heroStat("3714", "DAYS"), new LinearLayout.LayoutParams(0, dp(54), 1f));
        LinearLayout.LayoutParams middleStat = new LinearLayout.LayoutParams(0, dp(54), 1f);
        middleStat.leftMargin = dp(10);
        statRow.addView(heroStat("62%", "PLANNED"), middleStat);
        LinearLayout.LayoutParams lastStat = new LinearLayout.LayoutParams(0, dp(54), 1f);
        lastStat.leftMargin = dp(10);
        statRow.addView(heroStat("150", "GUESTS"), lastStat);
        card.addView(statRow, statRowParams);
        return card;
    }

    private View heroStat(String value, String label) {
        LinearLayout stat = new LinearLayout(this);
        stat.setOrientation(LinearLayout.VERTICAL);
        stat.setGravity(Gravity.CENTER);
        stat.setBackground(rounded(Color.argb(185, 255, 255, 255), dp(18), Color.argb(130, 247, 221, 226), dp(1)));

        TextView valueView = new TextView(this);
        valueView.setText(value);
        valueView.setTextColor(WINE);
        valueView.setTextSize(18);
        valueView.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
        valueView.setIncludeFontPadding(false);
        stat.addView(valueView, new LinearLayout.LayoutParams(-2, -2));

        TextView labelView = new TextView(this);
        labelView.setText(label);
        labelView.setTextColor(MUTED);
        labelView.setTextSize(9);
        labelView.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        labelView.setIncludeFontPadding(false);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(-2, -2);
        labelParams.topMargin = dp(5);
        stat.addView(labelView, labelParams);
        return stat;
    }

    private TextView sectionLabel(String text) {
        TextView label = new TextView(this);
        label.setText(text.toUpperCase(Locale.US));
        label.setTextColor(WINE);
        label.setTextSize(11);
        label.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        label.setIncludeFontPadding(false);
        label.setPadding(dp(2), 0, 0, dp(10));
        return label;
    }

    private View progressCard() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(14), dp(16), dp(16));
        card.setBackground(gradientRounded(WHITE, Color.rgb(255, 250, 249), dp(22), Color.argb(100, 247, 221, 226), dp(1)));
        card.setElevation(dp(6));
        card.setClickable(true);
        card.setOnClickListener(v -> showNativeSection("vendors"));
        card.addView(sectionTitle("Progress"));

        View track = new ProgressStrip(this);
        LinearLayout.LayoutParams trackParams = new LinearLayout.LayoutParams(-1, dp(14));
        trackParams.topMargin = dp(14);
        card.addView(track, trackParams);

        TextView copy = new TextView(this);
        copy.setText("62% Complete");
        copy.setTextColor(INK);
        copy.setTextSize(15);
        LinearLayout.LayoutParams copyParams = new LinearLayout.LayoutParams(-1, -2);
        copyParams.topMargin = dp(12);
        card.addView(copy, copyParams);
        return card;
    }

    private View vendorRow(String name, String type, String amount, String note, boolean highlighted, String detailSection) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(14), dp(14), dp(14), dp(14));
        row.setBackground(gradientRounded(WHITE, highlighted ? PETAL : Color.rgb(255, 250, 249), dp(22), highlighted ? BLUSH : Color.argb(90, 247, 221, 226), dp(1)));
        row.setElevation(dp(6));
        row.setClickable(true);
        row.setOnClickListener(v -> showNativeSection(detailSection));
        row.addView(new VendorBadge(this), new LinearLayout.LayoutParams(dp(48), dp(48)));
        LinearLayout text = new LinearLayout(this);
        text.setOrientation(LinearLayout.VERTICAL);
        text.setPadding(dp(12), 0, 0, 0);
        TextView title = new TextView(this);
        title.setText(name);
        title.setTextColor(INK);
        title.setTextSize(15);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        text.addView(title);
        TextView sub = new TextView(this);
        sub.setText(type + " - " + note);
        sub.setTextColor(MUTED);
        sub.setTextSize(11);
        text.addView(sub);
        row.addView(text, new LinearLayout.LayoutParams(0, -2, 1f));
        TextView price = new TextView(this);
        price.setText(amount);
        price.setTextColor(WINE);
        price.setTextSize(14);
        price.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        row.addView(price);
        return row;
    }

    private View nativeMenuCard(String title, String subtitle, String section) {
        LinearLayout card = new LinearLayout(this);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(16), dp(14), dp(16), dp(14));
        card.setBackground(gradientRounded(WHITE, Color.rgb(255, 250, 249), dp(22), Color.argb(95, 247, 221, 226), dp(1)));
        card.setElevation(dp(6));
        card.setClickable(true);
        card.setOnClickListener(v -> showNativeSection(section));
        LinearLayout text = new LinearLayout(this);
        text.setOrientation(LinearLayout.VERTICAL);
        text.addView(sectionTitle(title));
        TextView subtitleView = new TextView(this);
        subtitleView.setText(subtitle);
        subtitleView.setTextColor(MUTED);
        subtitleView.setTextSize(12);
        text.addView(subtitleView);
        card.addView(text, new LinearLayout.LayoutParams(0, -2, 1f));

        TextView arrow = new TextView(this);
        arrow.setText(">");
        arrow.setTextColor(GOLD);
        arrow.setTextSize(24);
        card.addView(arrow);
        return card;
    }

    private View menuCard(String title, String subtitle, String url) {
        LinearLayout card = new LinearLayout(this);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(16), dp(14), dp(16), dp(14));
        card.setBackground(gradientRounded(WHITE, Color.rgb(255, 250, 249), dp(22), Color.argb(95, 247, 221, 226), dp(1)));
        card.setElevation(dp(6));
        card.setClickable(true);
        card.setOnClickListener(v -> showWebPage(url));
        LinearLayout text = new LinearLayout(this);
        text.setOrientation(LinearLayout.VERTICAL);
        TextView titleView = sectionTitle(title);
        text.addView(titleView);
        TextView subtitleView = new TextView(this);
        subtitleView.setText(subtitle);
        subtitleView.setTextColor(MUTED);
        subtitleView.setTextSize(12);
        text.addView(subtitleView);
        card.addView(text, new LinearLayout.LayoutParams(0, -2, 1f));

        TextView arrow = new TextView(this);
        arrow.setText(">");
        arrow.setTextColor(GOLD);
        arrow.setTextSize(24);
        card.addView(arrow);
        return card;
    }

    private View infoCard(String eyebrow, String title, String body) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(14), dp(16), dp(14));
        card.setBackground(gradientRounded(WHITE, Color.rgb(255, 250, 249), dp(22), Color.argb(95, 247, 221, 226), dp(1)));
        card.setElevation(dp(6));

        TextView eyebrowView = new TextView(this);
        eyebrowView.setText(eyebrow.toUpperCase(Locale.US));
        eyebrowView.setTextColor(WINE);
        eyebrowView.setTextSize(10);
        eyebrowView.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        card.addView(eyebrowView);

        TextView titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextColor(INK);
        titleView.setTextSize(19);
        titleView.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(-1, -2);
        titleParams.topMargin = dp(6);
        card.addView(titleView, titleParams);

        TextView bodyView = new TextView(this);
        bodyView.setText(body);
        bodyView.setTextColor(MUTED);
        bodyView.setTextSize(12);
        LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(-1, -2);
        bodyParams.topMargin = dp(4);
        card.addView(bodyView, bodyParams);
        return card;
    }

    private View actionCard(String title, String subtitle, String cta, String url) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(14), dp(16), dp(16));
        card.setBackground(gradientRounded(WHITE, Color.rgb(255, 250, 249), dp(22), Color.argb(95, 247, 221, 226), dp(1)));
        card.setElevation(dp(6));
        card.setClickable(true);
        card.setOnClickListener(v -> {
            if (HOME_URL.equals(url)) {
                showNativeSection("home");
            } else {
                showWebPage(url);
            }
        });

        TextView titleView = sectionTitle(title);
        card.addView(titleView);
        TextView subtitleView = new TextView(this);
        subtitleView.setText(subtitle);
        subtitleView.setTextColor(MUTED);
        subtitleView.setTextSize(12);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(-1, -2);
        subtitleParams.topMargin = dp(4);
        card.addView(subtitleView, subtitleParams);

        TextView button = new TextView(this);
        button.setText(cta);
        button.setTextColor(WHITE);
        button.setTextSize(13);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(14), 0, dp(14), 0);
        button.setBackground(rounded(WINE, dp(16), Color.TRANSPARENT, 0));
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(-2, dp(34));
        buttonParams.topMargin = dp(12);
        card.addView(button, buttonParams);
        return card;
    }

    private View nativeActionCard(String title, String subtitle, String cta, String section) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(14), dp(16), dp(16));
        card.setBackground(gradientRounded(WHITE, Color.rgb(255, 250, 249), dp(22), Color.argb(95, 247, 221, 226), dp(1)));
        card.setElevation(dp(6));
        card.setClickable(true);
        card.setOnClickListener(v -> showNativeSection(section));

        card.addView(sectionTitle(title));
        TextView subtitleView = new TextView(this);
        subtitleView.setText(subtitle);
        subtitleView.setTextColor(MUTED);
        subtitleView.setTextSize(12);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(-1, -2);
        subtitleParams.topMargin = dp(4);
        card.addView(subtitleView, subtitleParams);

        TextView button = new TextView(this);
        button.setText(cta);
        button.setTextColor(WHITE);
        button.setTextSize(13);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(14), 0, dp(14), 0);
        button.setBackground(rounded(WINE, dp(16), Color.TRANSPARENT, 0));
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(-2, dp(34));
        buttonParams.topMargin = dp(12);
        card.addView(button, buttonParams);
        return card;
    }

    private View workflowCard(String title, String subtitle, String leftMetric, String rightMetric) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(14), dp(16), dp(16));
        card.setBackground(gradientRounded(WHITE, PETAL, dp(24), BLUSH, dp(1)));
        card.setElevation(dp(7));

        card.addView(sectionTitle(title));
        TextView subtitleView = new TextView(this);
        subtitleView.setText(subtitle);
        subtitleView.setTextColor(MUTED);
        subtitleView.setTextSize(12);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(-1, -2);
        subtitleParams.topMargin = dp(5);
        card.addView(subtitleView, subtitleParams);

        LinearLayout metrics = new LinearLayout(this);
        metrics.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams metricsParams = new LinearLayout.LayoutParams(-1, -2);
        metricsParams.topMargin = dp(14);
        metrics.addView(metricPill(leftMetric, WINE), new LinearLayout.LayoutParams(0, dp(34), 1f));
        LinearLayout.LayoutParams rightParams = new LinearLayout.LayoutParams(0, dp(34), 1f);
        rightParams.leftMargin = dp(10);
        metrics.addView(metricPill(rightMetric, GOLD), rightParams);
        card.addView(metrics, metricsParams);
        return card;
    }

    private TextView metricPill(String text, int color) {
        TextView pill = new TextView(this);
        pill.setText(text);
        pill.setTextColor(color);
        pill.setTextSize(12);
        pill.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        pill.setGravity(Gravity.CENTER);
        pill.setBackground(rounded(IVORY, dp(17), BLUSH, dp(1)));
        return pill;
    }

    private TextView statusPill(String text, int color, int background) {
        TextView pill = new TextView(this);
        pill.setText(text);
        pill.setTextColor(color);
        pill.setTextSize(11);
        pill.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        pill.setGravity(Gravity.CENTER);
        pill.setPadding(dp(10), 0, dp(10), 0);
        pill.setBackground(rounded(background, dp(14), Color.argb(95, 247, 221, 226), dp(1)));
        return pill;
    }

    private View workflowStep(String title, String subtitle, boolean done, String section) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(14), dp(12), dp(14), dp(12));
        row.setBackground(gradientRounded(WHITE, Color.rgb(255, 250, 249), dp(20), Color.argb(90, 247, 221, 226), dp(1)));
        row.setElevation(dp(5));
        row.setClickable(true);
        row.setOnClickListener(v -> showNativeSection(section));
        row.addView(new TaskCheck(this, done), new LinearLayout.LayoutParams(dp(30), dp(30)));

        LinearLayout text = new LinearLayout(this);
        text.setOrientation(LinearLayout.VERTICAL);
        text.setPadding(dp(10), 0, 0, 0);
        TextView titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextColor(INK);
        titleView.setTextSize(14);
        titleView.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        text.addView(titleView);
        TextView subtitleView = new TextView(this);
        subtitleView.setText(subtitle);
        subtitleView.setTextColor(MUTED);
        subtitleView.setTextSize(11);
        text.addView(subtitleView);
        row.addView(text, new LinearLayout.LayoutParams(0, -2, 1f));

        TextView arrow = new TextView(this);
        arrow.setText(">");
        arrow.setTextColor(GOLD);
        arrow.setTextSize(22);
        row.addView(arrow);
        return row;
    }

    private LinearLayout shortcutRow() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        row.setPadding(0, 0, 0, dp(12));
        return row;
    }

    private LinearLayout.LayoutParams shortcutParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, -1, 1f);
        params.leftMargin = dp(6);
        params.rightMargin = dp(6);
        return params;
    }

    private View vendorTrackingCard() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(16), dp(18), dp(18));
        card.setBackground(gradientRounded(WHITE, Color.rgb(255, 249, 248), dp(24), Color.argb(120, 247, 221, 226), dp(1)));
        card.setElevation(dp(8));

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = sectionTitle("Vendor Tracking");
        header.addView(title, new LinearLayout.LayoutParams(0, -2, 1f));
        TextView viewAll = smallLink("View All");
        viewAll.setOnClickListener(v -> showNativeSection("vendors"));
        header.addView(viewAll, new LinearLayout.LayoutParams(-2, -2));
        card.addView(header, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout vendor = new LinearLayout(this);
        vendor.setGravity(Gravity.CENTER_VERTICAL);
        vendor.setPadding(dp(14), dp(12), dp(14), dp(12));
        vendor.setBackground(gradientRounded(Color.rgb(255, 252, 250), PETAL, dp(18), Color.argb(95, 247, 221, 226), dp(1)));
        vendor.setClickable(true);
        vendor.setOnClickListener(v -> showNativeSection("vendor-lilys"));
        LinearLayout.LayoutParams vendorParams = new LinearLayout.LayoutParams(-1, dp(88));
        vendorParams.topMargin = dp(14);

        View badge = new VendorBadge(this);
        vendor.addView(badge, new LinearLayout.LayoutParams(dp(54), dp(54)));

        LinearLayout copy = new LinearLayout(this);
        copy.setOrientation(LinearLayout.VERTICAL);
        copy.setPadding(dp(12), 0, 0, 0);
        TextView name = new TextView(this);
        name.setText("Lily's Blooms");
        name.setTextColor(INK);
        name.setTextSize(15);
        name.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        copy.addView(name);
        TextView due = new TextView(this);
        due.setText("Due in 2 weeks");
        due.setTextColor(MUTED);
        due.setTextSize(11);
        copy.addView(due);
        vendor.addView(copy, new LinearLayout.LayoutParams(0, -2, 1f));

        LinearLayout moneyStack = new LinearLayout(this);
        moneyStack.setOrientation(LinearLayout.VERTICAL);
        moneyStack.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        TextView amount = new TextView(this);
        amount.setText("$750.00");
        amount.setTextColor(WINE);
        amount.setTextSize(15);
        amount.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        amount.setGravity(Gravity.RIGHT);
        moneyStack.addView(amount, new LinearLayout.LayoutParams(-2, -2));
        LinearLayout.LayoutParams pillParams = new LinearLayout.LayoutParams(-2, dp(28));
        pillParams.topMargin = dp(7);
        moneyStack.addView(statusPill("Due soon", GOLD, Color.rgb(255, 244, 229)), pillParams);
        vendor.addView(moneyStack, new LinearLayout.LayoutParams(-2, -2));

        card.addView(vendor, vendorParams);
        return card;
    }

    private View taskCard() {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        card.setBackground(gradientRounded(WHITE, Color.rgb(255, 250, 249), dp(24), Color.argb(115, 247, 221, 226), dp(1)));
        card.setElevation(dp(8));
        card.setClickable(true);
        card.setOnClickListener(v -> showNativeSection("checklist"));

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.addView(sectionTitle("My Tasks"), new LinearLayout.LayoutParams(0, -2, 1f));
        TextView viewAll = smallLink("View All");
        viewAll.setOnClickListener(v -> showNativeSection("checklist"));
        header.addView(viewAll, new LinearLayout.LayoutParams(-2, -2));
        card.addView(header);

        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(-1, dp(10));
        progressParams.topMargin = dp(12);
        progressParams.bottomMargin = dp(8);
        card.addView(new ProgressStrip(this), progressParams);

        card.addView(taskRow("Venue tour w/ Amazing Manor", "Due soon", true, "task-venue"));
        card.addView(taskRow("Confirm photographer", "Due this week", true, "task-photo"));
        card.addView(taskRow("Final guest list due", "Upcoming", false, "task-guests"));
        return card;
    }

    private View taskRow(String title, String subtitle, boolean done, String section) {
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(12), 0, dp(6));
        row.setClickable(true);
        row.setOnClickListener(v -> showNativeSection(section));
        row.addView(new TaskCheck(this, done), new LinearLayout.LayoutParams(dp(28), dp(28)));
        LinearLayout text = new LinearLayout(this);
        text.setOrientation(LinearLayout.VERTICAL);
        text.setPadding(dp(10), 0, 0, 0);
        TextView titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextColor(INK);
        titleView.setTextSize(14);
        text.addView(titleView);
        TextView subtitleView = new TextView(this);
        subtitleView.setText(subtitle);
        subtitleView.setTextColor(MUTED);
        subtitleView.setTextSize(11);
        text.addView(subtitleView);
        row.addView(text, new LinearLayout.LayoutParams(0, -2, 1f));
        if (done) {
            row.addView(statusPill("Done", Color.rgb(116, 139, 93), Color.rgb(239, 244, 232)), new LinearLayout.LayoutParams(-2, dp(27)));
        }
        TextView arrow = new TextView(this);
        arrow.setText(">");
        arrow.setTextColor(GOLD);
        arrow.setTextSize(18);
        row.addView(arrow);
        return row;
    }

    private TextView sectionTitle(String text) {
        TextView title = new TextView(this);
        title.setText(text);
        title.setTextColor(INK);
        title.setTextSize(16);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return title;
    }

    private TextView smallLink(String text) {
        TextView link = new TextView(this);
        link.setText(text);
        link.setTextColor(WINE);
        link.setTextSize(12);
        link.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return link;
    }

    private View createBottomBar() {
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER);
        bar.setPadding(dp(10), dp(7), dp(10), dp(6));
        bar.setBackground(gradientRounded(WHITE, Color.rgb(255, 249, 248), dp(30), Color.argb(120, 247, 221, 226), dp(1)));
        bar.setElevation(dp(18));

        homeTab = new NativeTabButton(this, "Home", TabIcon.HOME);
        vendorsTab = new NativeTabButton(this, "Vendors", TabIcon.STORE);
        checklistTab = new NativeTabButton(this, "Checklist", TabIcon.CHECK);
        moreTab = new NativeTabButton(this, "More", TabIcon.MORE);

        homeTab.setOnClickListener(v -> showNativeSection("home"));
        vendorsTab.setOnClickListener(v -> showNativeSection("vendors"));
        checklistTab.setOnClickListener(v -> showNativeSection("checklist"));
        moreTab.setOnClickListener(v -> showNativeSection("more"));

        bar.addView(homeTab, tabParams());
        bar.addView(vendorsTab, tabParams());
        SpaceView centerSpace = new SpaceView(this);
        bar.addView(centerSpace, new LinearLayout.LayoutParams(dp(80), -1));
        bar.addView(checklistTab, tabParams());
        bar.addView(moreTab, tabParams());
        return bar;
    }

    private LinearLayout.LayoutParams tabParams() {
        return new LinearLayout.LayoutParams(0, -1, 1f);
    }

    private View createSplash() {
        FrameLayout view = new FrameLayout(this);
        view.setBackgroundColor(WHITE);
        view.setAlpha(0f);

        BrandLogoView logo = new BrandLogoView(this, false);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(dp(210), dp(170), Gravity.CENTER);
        view.addView(logo, params);
        return view;
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        webView.setBackgroundColor(WHITE);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isInternal(uri)) {
                    activeUrl = uri.toString();
                    updateActiveTab(activeUrl);
                    return false;
                }
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                activeUrl = url;
                updateActiveTab(url);
                applyWeddingAppChromeCss();
                webView.animate().alpha(1f).setDuration(180).start();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame() && "web".equals(currentNativeScreen)) {
                    webView.stopLoading();
                    showNativeSection("offline");
                }
            }
        });
    }

    private void applyWeddingAppChromeCss() {
        String script = "(function(){"
            + "var id='aido-native-wrapper-style';"
            + "var existing=document.getElementById(id);"
            + "if(existing){existing.remove();}"
            + "var style=document.createElement('style');"
            + "style.id=id;"
            + "style.textContent='"
            + "html,body{background:#fff7f8!important;}"
            + "body{padding-top:0!important;padding-bottom:18px!important;}"
            + "body>div:first-child{padding-top:0!important;}"
            + ".md\\\\:hidden.fixed.top-0,.md\\\\:hidden.fixed.inset-0{display:none!important;}"
            + "[data-testid=btn-toggle-menu]{display:none!important;}"
            + "*{scroll-margin-top:18px!important;}"
            + "a,button{transition:transform .18s ease,opacity .18s ease,box-shadow .18s ease!important;}"
            + "button:active,a:active{transform:scale(.98)!important;}"
            + "';"
            + "document.head.appendChild(style);"
            + "Array.from(document.querySelectorAll('header,nav,div,button')).forEach(function(el){"
            + "var s=getComputedStyle(el);"
            + "var rect=el.getBoundingClientRect();"
            + "var text=(el.innerText||'').trim();"
            + "if(s.position==='fixed'&&rect.top<=4&&rect.height<=90){el.style.display='none';}"
            + "if(s.position==='fixed'&&rect.bottom>window.innerHeight-120&&rect.right>window.innerWidth-140&&text.indexOf('Hide')>-1){el.style.display='none';}"
            + "});"
            + "var root=document.querySelector('#root');if(root){root.style.paddingTop='0px';}"
            + "})();";
        webView.evaluateJavascript(script, null);
    }

    private String pagePath(String url) {
        String path = Uri.parse(url == null ? HOME_URL : url).getPath();
        if (path == null || path.isEmpty()) {
            return "/";
        }
        return path;
    }

    private void setHomeOverlayVisible(boolean visible) {
        if (homeOverlay == null) {
            return;
        }
        homeOverlay.setVisibility(visible ? View.VISIBLE : View.GONE);
        homeOverlay.animate().alpha(visible ? 1f : 0f).setDuration(180).start();
    }

    private void showWebPage(String url) {
        currentNativeScreen = "web";
        setHomeOverlayVisible(false);
        if (sectionOverlay != null) {
            sectionOverlay.setVisibility(View.GONE);
            sectionOverlay.setAlpha(0f);
        }
        webView.setVisibility(View.VISIBLE);
        navigate(url);
    }

    private void navigate(String url) {
        if (sameDestination(activeUrl, url)) {
            return;
        }
        activeUrl = url;
        updateActiveTab(url);
        webView.animate().alpha(0.88f).setDuration(110).withEndAction(() -> webView.loadUrl(url)).start();
    }

    private boolean isInternal(Uri uri) {
        String host = uri.getHost();
        if (host == null) {
            return false;
        }
        String normalized = host.toLowerCase(Locale.US);
        return normalized.equals(INTERNAL_HOST) || normalized.endsWith("." + INTERNAL_HOST);
    }

    private boolean sameDestination(String current, String target) {
        Uri currentUri = Uri.parse(current == null ? "" : current);
        Uri targetUri = Uri.parse(target);
        String currentPath = currentUri.getPath() == null ? "/" : currentUri.getPath();
        String targetPath = targetUri.getPath() == null ? "/" : targetUri.getPath();
        return isInternal(currentUri) && currentPath.equals(targetPath);
    }

    private void updateActiveTab(String url) {
        if (homeTab == null) {
            return;
        }
        String path = pagePath(url);
        homeTab.setActive(path.equals("/") || path.startsWith("/dashboard"));
        vendorsTab.setActive(path.startsWith("/vendors"));
        checklistTab.setActive(path.startsWith("/checklist"));
        moreTab.setActive(path.startsWith("/settings") || path.startsWith("/more"));
        addButton.setActive(path.startsWith("/aria"));
    }

    @Override
    public void onBackPressed() {
        if (!"home".equals(currentNativeScreen) && sectionOverlay != null && sectionOverlay.getVisibility() == View.VISIBLE) {
            showNativeSection("home");
            return;
        }
        if ("web".equals(currentNativeScreen) && webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        if ("web".equals(currentNativeScreen)) {
            showNativeSection("home");
            return;
        }
        super.onBackPressed();
    }

    private GradientDrawable rounded(int color, int radius, int strokeColor, int strokeWidth) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radius);
        if (strokeWidth > 0) {
            drawable.setStroke(strokeWidth, strokeColor);
        }
        return drawable;
    }

    private GradientDrawable gradientRounded(int startColor, int endColor, int radius, int strokeColor, int strokeWidth) {
        GradientDrawable drawable = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            new int[] { startColor, endColor }
        );
        drawable.setCornerRadius(radius);
        if (strokeWidth > 0) {
            drawable.setStroke(strokeWidth, strokeColor);
        }
        return drawable;
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private enum TabIcon {
        HOME,
        STORE,
        CHECK,
        MORE
    }

    private enum MiniIcon {
        HEART,
        IMAGE,
        TIMELINE,
        CALENDAR,
        CHECK,
        BUDGET
    }

    private class WeddingBackdropScrollView extends ScrollView {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path leaf = new Path();

        WeddingBackdropScrollView(Activity activity) {
            super(activity);
            setWillNotDraw(false);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float w = getWidth();
            float h = getHeight();
            paint.setStyle(Paint.Style.FILL);
            paint.setShader(new LinearGradient(
                0,
                0,
                0,
                h,
                new int[] { WHITE, Color.rgb(255, 247, 248), CREAM },
                new float[] { 0f, 0.55f, 1f },
                Shader.TileMode.CLAMP
            ));
            canvas.drawRect(0, 0, w, h, paint);
            paint.setShader(null);

            paint.setShader(new RadialGradient(w * 0.18f, h * 0.12f, w * 0.45f, Color.argb(120, 247, 221, 226), Color.TRANSPARENT, Shader.TileMode.CLAMP));
            canvas.drawCircle(w * 0.18f, h * 0.12f, w * 0.45f, paint);
            paint.setShader(new RadialGradient(w * 0.9f, h * 0.35f, w * 0.38f, Color.argb(90, 212, 163, 115), Color.TRANSPARENT, Shader.TileMode.CLAMP));
            canvas.drawCircle(w * 0.9f, h * 0.35f, w * 0.38f, paint);
            paint.setShader(null);

            drawLeafCluster(canvas, w * 0.88f, h * 0.16f, dp(26), -28f);
            drawLeafCluster(canvas, w * 0.08f, h * 0.72f, dp(22), 18f);
            super.onDraw(canvas);
        }

        private void drawLeafCluster(Canvas canvas, float x, float y, float size, float rotation) {
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.argb(38, 141, 61, 88));
            canvas.save();
            canvas.rotate(rotation, x, y);
            for (int i = 0; i < 5; i++) {
                float offset = (i - 2) * size * 0.35f;
                drawLeaf(canvas, x + offset, y + Math.abs(i - 2) * size * 0.12f, size * (0.72f - i * 0.035f), i % 2 == 0 ? -24f : 24f);
            }
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(1));
            paint.setColor(Color.argb(40, 212, 163, 115));
            canvas.drawLine(x - size * 1.1f, y + size * 0.35f, x + size * 1.1f, y - size * 0.35f, paint);
            canvas.restore();
        }

        private void drawLeaf(Canvas canvas, float x, float y, float size, float rotation) {
            leaf.reset();
            leaf.moveTo(x, y - size * 0.55f);
            leaf.cubicTo(x + size * 0.58f, y - size * 0.3f, x + size * 0.58f, y + size * 0.32f, x, y + size * 0.62f);
            leaf.cubicTo(x - size * 0.58f, y + size * 0.32f, x - size * 0.58f, y - size * 0.3f, x, y - size * 0.55f);
            canvas.save();
            canvas.rotate(rotation, x, y);
            canvas.drawPath(leaf, paint);
            canvas.restore();
        }
    }

    private class RingsAccentView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        RingsAccentView(Activity activity) {
            super(activity);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float w = getWidth();
            float h = getHeight();
            float r = Math.min(w, h) * 0.27f;
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.argb(65, 247, 221, 226));
            canvas.drawCircle(w * 0.5f, h * 0.5f, r * 1.45f, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(2));
            paint.setColor(GOLD);
            canvas.drawCircle(w * 0.43f, h * 0.48f, r, paint);
            paint.setColor(Color.rgb(190, 145, 91));
            canvas.drawCircle(w * 0.6f, h * 0.48f, r, paint);
        }
    }

    private class ShortcutCard extends LinearLayout {
        ShortcutCard(Activity activity, String label, MiniIcon icon, Runnable action) {
            super(activity);
            setOrientation(VERTICAL);
            setGravity(Gravity.CENTER);
            setClickable(true);
            setPadding(dp(8), dp(10), dp(8), dp(10));
            setBackground(gradientRounded(WHITE, Color.rgb(255, 250, 249), dp(18), Color.argb(95, 247, 221, 226), dp(1)));
            setElevation(dp(7));
            setOnClickListener(v -> action.run());

            MiniIconView iconView = new MiniIconView(activity, icon);
            addView(iconView, new LinearLayout.LayoutParams(dp(38), dp(38)));

            TextView labelView = new TextView(activity);
            labelView.setText(label);
            labelView.setTextColor(INK);
            labelView.setTextSize(12);
            labelView.setGravity(Gravity.CENTER);
            labelView.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            labelView.setIncludeFontPadding(false);
            labelView.setLineSpacing(0f, 0.94f);
            labelView.setMaxLines(2);
            LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(-1, -2);
            labelParams.topMargin = dp(7);
            addView(labelView, labelParams);
        }
    }

    private class MiniIconView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final MiniIcon icon;

        MiniIconView(Activity activity, MiniIcon icon) {
            super(activity);
            this.icon = icon;
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeJoin(Paint.Join.ROUND);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float w = getWidth();
            float h = getHeight();
            float cx = w / 2f;
            float cy = h / 2f;
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(IVORY);
            canvas.drawCircle(cx, cy, Math.min(w, h) * 0.46f, paint);
            paint.setColor(BLUSH);
            canvas.drawCircle(cx, cy, Math.min(w, h) * 0.37f, paint);
            paint.setColor(icon == MiniIcon.BUDGET || icon == MiniIcon.IMAGE ? GOLD : WINE);
            paint.setStrokeWidth(dp(2.3f));
            paint.setStyle(Paint.Style.STROKE);
            if (icon == MiniIcon.HEART) {
                Path p = new Path();
                p.moveTo(w * 0.5f, h * 0.78f);
                p.cubicTo(w * 0.15f, h * 0.55f, w * 0.12f, h * 0.28f, w * 0.34f, h * 0.25f);
                p.cubicTo(w * 0.44f, h * 0.23f, w * 0.5f, h * 0.32f, w * 0.5f, h * 0.36f);
                p.cubicTo(w * 0.5f, h * 0.32f, w * 0.56f, h * 0.23f, w * 0.66f, h * 0.25f);
                p.cubicTo(w * 0.88f, h * 0.28f, w * 0.85f, h * 0.55f, w * 0.5f, h * 0.78f);
                paint.setStyle(Paint.Style.FILL);
                canvas.drawPath(p, paint);
            } else if (icon == MiniIcon.IMAGE) {
                paint.setColor(WINE);
                canvas.drawRoundRect(new RectF(w * 0.18f, h * 0.22f, w * 0.82f, h * 0.78f), dp(4), dp(4), paint);
                paint.setColor(GOLD);
                canvas.drawCircle(w * 0.36f, h * 0.38f, dp(3), paint);
                paint.setColor(WINE);
                Path mountain = new Path();
                mountain.moveTo(w * 0.24f, h * 0.7f);
                mountain.lineTo(w * 0.46f, h * 0.52f);
                mountain.lineTo(w * 0.58f, h * 0.64f);
                mountain.lineTo(w * 0.68f, h * 0.54f);
                mountain.lineTo(w * 0.78f, h * 0.7f);
                canvas.drawPath(mountain, paint);
            } else if (icon == MiniIcon.TIMELINE) {
                paint.setColor(WINE);
                canvas.drawRoundRect(new RectF(w * 0.2f, h * 0.26f, w * 0.8f, h * 0.76f), dp(3), dp(3), paint);
                paint.setColor(GOLD);
                canvas.drawLine(w * 0.32f, h * 0.42f, w * 0.68f, h * 0.42f, paint);
                canvas.drawLine(w * 0.32f, h * 0.56f, w * 0.62f, h * 0.56f, paint);
            } else if (icon == MiniIcon.CALENDAR) {
                paint.setColor(WINE);
                canvas.drawRoundRect(new RectF(w * 0.22f, h * 0.25f, w * 0.78f, h * 0.8f), dp(4), dp(4), paint);
                paint.setColor(GOLD);
                canvas.drawLine(w * 0.22f, h * 0.42f, w * 0.78f, h * 0.42f, paint);
                paint.setColor(WINE);
                canvas.drawLine(w * 0.36f, h * 0.18f, w * 0.36f, h * 0.32f, paint);
                canvas.drawLine(w * 0.64f, h * 0.18f, w * 0.64f, h * 0.32f, paint);
            } else if (icon == MiniIcon.CHECK) {
                paint.setColor(WINE);
                canvas.drawRoundRect(new RectF(w * 0.22f, h * 0.22f, w * 0.78f, h * 0.78f), dp(5), dp(5), paint);
                paint.setColor(GOLD);
                canvas.drawLine(w * 0.34f, h * 0.52f, w * 0.46f, h * 0.64f, paint);
                canvas.drawLine(w * 0.46f, h * 0.64f, w * 0.68f, h * 0.38f, paint);
            } else {
                paint.setColor(WINE);
                canvas.drawRoundRect(new RectF(w * 0.24f, h * 0.22f, w * 0.76f, h * 0.8f), dp(4), dp(4), paint);
                paint.setStyle(Paint.Style.FILL);
                paint.setTextSize(dp(20));
                paint.setTypeface(Typeface.DEFAULT_BOLD);
                paint.setColor(GOLD);
                canvas.drawText("$", w * 0.42f, h * 0.62f, paint);
            }
        }
    }

    private class CoupleAvatar extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        CoupleAvatar(Activity activity) {
            super(activity);
            setBackground(rounded(WHITE, dp(31), BLUSH, dp(2)));
            setElevation(dp(6));
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float w = getWidth();
            float h = getHeight();
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(BLUSH);
            canvas.drawCircle(w * 0.42f, h * 0.42f, w * 0.2f, paint);
            paint.setColor(GOLD);
            canvas.drawCircle(w * 0.62f, h * 0.42f, w * 0.2f, paint);
            paint.setColor(WHITE);
            canvas.drawCircle(w * 0.42f, h * 0.37f, w * 0.07f, paint);
            canvas.drawCircle(w * 0.62f, h * 0.37f, w * 0.07f, paint);
            paint.setColor(WINE);
            canvas.drawCircle(w * 0.76f, h * 0.76f, w * 0.16f, paint);
        }
    }

    private class VendorBadge extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        VendorBadge(Activity activity) {
            super(activity);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float r = Math.min(getWidth(), getHeight()) / 2f;
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(IVORY);
            canvas.drawCircle(r, r, r * 0.92f, paint);
            paint.setColor(BLUSH);
            canvas.drawCircle(r, r, r * 0.74f, paint);
            paint.setColor(GOLD);
            canvas.drawCircle(r, r, r * 0.42f, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(2));
            paint.setColor(WINE);
            canvas.drawCircle(r, r, r * 0.88f, paint);
        }
    }

    private class TaskCheck extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final boolean done;

        TaskCheck(Activity activity, boolean done) {
            super(activity);
            this.done = done;
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float w = getWidth();
            float h = getHeight();
            paint.setStyle(done ? Paint.Style.FILL : Paint.Style.STROKE);
            paint.setStrokeWidth(dp(2));
            paint.setColor(done ? WINE : Color.rgb(210, 170, 184));
            canvas.drawRoundRect(new RectF(w * 0.18f, h * 0.18f, w * 0.82f, h * 0.82f), dp(5), dp(5), paint);
            if (done) {
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeCap(Paint.Cap.ROUND);
                paint.setColor(GOLD);
                canvas.drawLine(w * 0.34f, h * 0.52f, w * 0.46f, h * 0.64f, paint);
                canvas.drawLine(w * 0.46f, h * 0.64f, w * 0.68f, h * 0.38f, paint);
            }
        }
    }

    private class ProgressStrip extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        ProgressStrip(Activity activity) {
            super(activity);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float centerY = getHeight() / 2f;
            float radius = getHeight() * 0.32f;
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(BLUSH);
            canvas.drawRoundRect(new RectF(0, centerY - radius, getWidth(), centerY + radius), radius, radius, paint);
            paint.setColor(WINE);
            canvas.drawRoundRect(new RectF(0, centerY - radius, getWidth() * 0.62f, centerY + radius), radius, radius, paint);
        }
    }

    private class SearchIcon extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        SearchIcon(Activity activity) {
            super(activity);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float w = getWidth();
            float h = getHeight();
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(2.4f));
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setColor(INK);
            canvas.drawCircle(w * 0.45f, h * 0.42f, w * 0.22f, paint);
            canvas.drawLine(w * 0.61f, h * 0.6f, w * 0.78f, h * 0.78f, paint);
        }
    }

    private class NativeTabButton extends LinearLayout {
        private final IconView icon;
        private final TextView label;

        NativeTabButton(Activity activity, String text, TabIcon iconType) {
            super(activity);
            setOrientation(VERTICAL);
            setGravity(Gravity.CENTER);
            setClickable(true);
            setBackground(rounded(Color.TRANSPARENT, dp(16), Color.TRANSPARENT, 0));

            icon = new IconView(activity, iconType);
            addView(icon, new LinearLayout.LayoutParams(dp(28), dp(28)));

            label = new TextView(activity);
            label.setText(text);
            label.setTextSize(11);
            label.setGravity(Gravity.CENTER);
            label.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
            addView(label, new LinearLayout.LayoutParams(-2, dp(18)));
            setActive(false);
        }

        void setActive(boolean active) {
            icon.setActive(active);
            label.setTextColor(active ? WINE : MUTED);
            animate().scaleX(active ? 1.04f : 1f).scaleY(active ? 1.04f : 1f).setDuration(160).start();
        }
    }

    private class IconView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final TabIcon icon;
        private boolean active;

        IconView(Activity activity, TabIcon icon) {
            super(activity);
            this.icon = icon;
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStrokeJoin(Paint.Join.ROUND);
        }

        void setActive(boolean active) {
            this.active = active;
            invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float w = getWidth();
            float h = getHeight();
            if (active) {
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(BLUSH);
                canvas.drawCircle(w / 2f, h / 2f, Math.min(w, h) * 0.46f, paint);
            }
            paint.setColor(active ? WINE : MUTED);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(2.2f));
            if (icon == TabIcon.HOME) {
                Path roof = new Path();
                roof.moveTo(w * 0.18f, h * 0.5f);
                roof.lineTo(w * 0.5f, h * 0.22f);
                roof.lineTo(w * 0.82f, h * 0.5f);
                canvas.drawPath(roof, paint);
                canvas.drawRoundRect(new RectF(w * 0.28f, h * 0.48f, w * 0.72f, h * 0.82f), dp(4), dp(4), paint);
            } else if (icon == TabIcon.STORE) {
                canvas.drawRoundRect(new RectF(w * 0.2f, h * 0.38f, w * 0.8f, h * 0.82f), dp(4), dp(4), paint);
                canvas.drawLine(w * 0.18f, h * 0.38f, w * 0.82f, h * 0.38f, paint);
                canvas.drawLine(w * 0.28f, h * 0.24f, w * 0.72f, h * 0.24f, paint);
                canvas.drawLine(w * 0.28f, h * 0.24f, w * 0.18f, h * 0.38f, paint);
                canvas.drawLine(w * 0.72f, h * 0.24f, w * 0.82f, h * 0.38f, paint);
            } else if (icon == TabIcon.CHECK) {
                canvas.drawRoundRect(new RectF(w * 0.22f, h * 0.22f, w * 0.78f, h * 0.78f), dp(5), dp(5), paint);
                canvas.drawLine(w * 0.36f, h * 0.52f, w * 0.47f, h * 0.64f, paint);
                canvas.drawLine(w * 0.47f, h * 0.64f, w * 0.67f, h * 0.4f, paint);
            } else {
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(active ? WINE : MUTED);
                canvas.drawCircle(w * 0.3f, h * 0.5f, dp(2.7f), paint);
                canvas.drawCircle(w * 0.5f, h * 0.5f, dp(2.7f), paint);
                canvas.drawCircle(w * 0.7f, h * 0.5f, dp(2.7f), paint);
            }
        }
    }

    private class FloatingActionButton extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private boolean active;

        FloatingActionButton(Activity activity) {
            super(activity);
            setClickable(true);
            setElevation(dp(30));
            setOnClickListener(v -> showNativeSection("aria"));
        }

        void setActive(boolean active) {
            this.active = active;
            invalidate();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float r = Math.min(getWidth(), getHeight()) * 0.46f;
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(BLUSH);
            canvas.drawCircle(getWidth() / 2f, getHeight() / 2f, r * 1.08f, paint);
            paint.setColor(active ? GOLD : WINE);
            canvas.drawCircle(getWidth() / 2f, getHeight() / 2f, r, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setColor(WHITE);
            paint.setStrokeWidth(dp(2.6f));
            paint.setStrokeCap(Paint.Cap.ROUND);
            canvas.drawLine(getWidth() * 0.34f, getHeight() * 0.5f, getWidth() * 0.66f, getHeight() * 0.5f, paint);
            canvas.drawLine(getWidth() * 0.5f, getHeight() * 0.34f, getWidth() * 0.5f, getHeight() * 0.66f, paint);
        }
    }

    private class BrandLogoView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final boolean compact;

        BrandLogoView(Activity activity, boolean compact) {
            super(activity);
            this.compact = compact;
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            if (compact) {
                drawCompactLogo(canvas);
            } else {
                drawSplashLogo(canvas);
            }
        }

        private void drawCompactLogo(Canvas canvas) {
            float w = getWidth();
            float h = getHeight();
            float cy = h * 0.42f;
            float ringSize = h * 0.44f;
            drawRings(canvas, ringSize * 0.85f, cy, ringSize);

            paint.setStyle(Paint.Style.FILL);
            paint.setColor(WINE);
            paint.setTypeface(Typeface.create(Typeface.SERIF, Typeface.NORMAL));
            paint.setTextSize(h * 0.33f);
            paint.setTextAlign(Paint.Align.LEFT);
            canvas.drawText("A.I Do", h * 0.92f, h * 0.58f, paint);

            paint.setColor(GOLD);
            paint.setStrokeWidth(dp(1));
            canvas.drawLine(h * 0.94f, h * 0.72f, w * 0.82f, h * 0.72f, paint);
        }

        private void drawSplashLogo(Canvas canvas) {
            float w = getWidth();
            float h = getHeight();
            float centerX = w / 2f;
            float ringSize = Math.min(w, h) * 0.34f;
            drawRings(canvas, centerX, h * 0.33f, ringSize);

            paint.setStyle(Paint.Style.FILL);
            paint.setColor(WINE);
            paint.setTypeface(Typeface.create(Typeface.SERIF, Typeface.NORMAL));
            paint.setTextSize(h * 0.23f);
            paint.setTextAlign(Paint.Align.CENTER);
            canvas.drawText("A.I Do", centerX, h * 0.67f, paint);

            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(1.2f));
            paint.setColor(BLUSH);
            canvas.drawLine(w * 0.2f, h * 0.78f, w * 0.42f, h * 0.78f, paint);
            canvas.drawLine(w * 0.58f, h * 0.78f, w * 0.8f, h * 0.78f, paint);

            paint.setStyle(Paint.Style.FILL);
            paint.setColor(GOLD);
            Path sparkle = new Path();
            sparkle.moveTo(centerX, h * 0.72f);
            sparkle.lineTo(centerX + dp(5), h * 0.78f);
            sparkle.lineTo(centerX, h * 0.84f);
            sparkle.lineTo(centerX - dp(5), h * 0.78f);
            sparkle.close();
            canvas.drawPath(sparkle, paint);
        }

        private void drawRings(Canvas canvas, float centerX, float centerY, float size) {
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(Math.max(dp(1.5f), size * 0.07f));
            paint.setColor(GOLD);
            paint.setAlpha(235);
            float r = size * 0.32f;
            RectF left = new RectF(centerX - r * 1.55f, centerY - r, centerX + r * 0.45f, centerY + r);
            RectF right = new RectF(centerX - r * 0.45f, centerY - r * 0.9f, centerX + r * 1.55f, centerY + r * 1.1f);
            canvas.drawOval(left, paint);
            paint.setColor(Color.rgb(177, 125, 72));
            canvas.drawOval(right, paint);

            paint.setAlpha(255);
            paint.setStrokeWidth(Math.max(dp(0.7f), size * 0.02f));
            paint.setColor(Color.argb(190, 255, 255, 255));
            canvas.drawArc(right, 230, 95, false, paint);
        }
    }

    private class ProfileIcon extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        ProfileIcon(Activity activity) {
            super(activity);
            setBackground(rounded(WHITE, dp(21), BLUSH, dp(1)));
            setElevation(dp(4));
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            paint.setStyle(Paint.Style.STROKE);
            paint.setColor(GOLD);
            paint.setStrokeWidth(dp(2));
            canvas.drawCircle(getWidth() / 2f, getHeight() * 0.4f, dp(6), paint);
            canvas.drawArc(new RectF(dp(10), dp(20), getWidth() - dp(10), getHeight() - dp(5)), 205, 130, false, paint);
        }
    }

    private static class SpaceView extends View {
        SpaceView(Activity activity) {
            super(activity);
        }
    }
}
