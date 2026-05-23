package net.aidowedding.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import java.io.File;
import java.io.IOException;

public class MainActivity extends Activity {
    private static final String HOME_URL = "https://aidowedding.net";
    private static final String ALLOWED_HOST = "aidowedding.net";
    private static final int FILE_CHOOSER_REQUEST = 1101;
    private static final int CAMERA_PERMISSION_REQUEST = 1102;

    private WebView webView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private ProgressBar loadingSpinner;
    private Button backButton;
    private LinearLayout errorView;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraCaptureUri;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        buildLayout();
        configureWebView();
        if (savedInstanceState == null) {
            webView.loadUrl(HOME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebViewClient(new AidoWebViewClient());
        webView.setWebChromeClient(new AidoWebChromeClient());
    }

    private void buildLayout() {
        FrameLayout root = new FrameLayout(this);

        swipeRefreshLayout = new SwipeRefreshLayout(this);
        swipeRefreshLayout.setColorSchemeColors(Color.rgb(141, 41, 77));
        swipeRefreshLayout.setOnRefreshListener(() -> {
            hideError();
            webView.reload();
        });

        webView = new WebView(this);
        swipeRefreshLayout.addView(webView, new SwipeRefreshLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        root.addView(swipeRefreshLayout, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        loadingSpinner = new ProgressBar(this);
        FrameLayout.LayoutParams spinnerParams = new FrameLayout.LayoutParams(96, 96, Gravity.CENTER);
        root.addView(loadingSpinner, spinnerParams);

        backButton = new Button(this);
        backButton.setText("Back");
        backButton.setVisibility(View.GONE);
        backButton.setOnClickListener(v -> goBackInWebView());
        FrameLayout.LayoutParams backParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.TOP | Gravity.START
        );
        backParams.setMargins(24, 48, 0, 0);
        root.addView(backButton, backParams);

        errorView = new LinearLayout(this);
        errorView.setOrientation(LinearLayout.VERTICAL);
        errorView.setGravity(Gravity.CENTER);
        errorView.setBackgroundColor(Color.WHITE);
        errorView.setVisibility(View.GONE);
        TextView errorText = new TextView(this);
        errorText.setText("A.IDO could not load. Check your connection and try again.");
        errorText.setTextColor(Color.rgb(36, 23, 29));
        errorText.setTextSize(17);
        errorText.setGravity(Gravity.CENTER);
        errorText.setPadding(48, 0, 48, 18);
        Button retryButton = new Button(this);
        retryButton.setText("Retry");
        retryButton.setOnClickListener(v -> {
            hideError();
            webView.loadUrl(HOME_URL);
        });
        errorView.addView(errorText);
        errorView.addView(retryButton);
        root.addView(errorView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        setContentView(root);
    }

    private void updateBackButton() {
        backButton.setVisibility(webView.canGoBack() ? View.VISIBLE : View.GONE);
    }

    private void hideError() {
        errorView.setVisibility(View.GONE);
    }

    private void showError() {
        loadingSpinner.setVisibility(View.GONE);
        swipeRefreshLayout.setRefreshing(false);
        errorView.setVisibility(View.VISIBLE);
    }

    private boolean isOnline() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        NetworkInfo info = manager == null ? null : manager.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private void goBackInWebView() {
        if (webView.canGoBack()) {
            webView.goBack();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private boolean isInternalUrl(Uri uri) {
        String host = uri.getHost();
        return host != null && (host.equalsIgnoreCase(ALLOWED_HOST) || host.toLowerCase().endsWith("." + ALLOWED_HOST));
    }

    private final class AidoWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String scheme = uri.getScheme();
            if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                if (isInternalUrl(uri)) return false;
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
                return true;
            }
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            loadingSpinner.setVisibility(View.VISIBLE);
            hideError();
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            loadingSpinner.setVisibility(View.GONE);
            swipeRefreshLayout.setRefreshing(false);
            updateBackButton();
            CookieManager.getInstance().flush();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame() && !isOnline()) {
                showError();
            }
        }
    }

    private final class AidoWebChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
            WebView webView,
            ValueCallback<Uri[]> filePathCallback,
            FileChooserParams fileChooserParams
        ) {
            if (MainActivity.this.filePathCallback != null) {
                MainActivity.this.filePathCallback.onReceiveValue(null);
            }
            MainActivity.this.filePathCallback = filePathCallback;
            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                openFileChooser(fileChooserParams, false);
            } else {
                openFileChooser(fileChooserParams, true);
            }
            return true;
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
            runOnUiThread(() -> {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(request.getResources());
                } else {
                    ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                    request.deny();
                }
            });
        }
    }

    private void openFileChooser(WebChromeClient.FileChooserParams params, boolean includeCamera) {
        Intent contentIntent = params.createIntent();
        contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
        contentIntent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"});

        Intent chooser = new Intent(Intent.ACTION_CHOOSER);
        chooser.putExtra(Intent.EXTRA_INTENT, contentIntent);
        chooser.putExtra(Intent.EXTRA_TITLE, "Choose file");

        if (includeCamera) {
            Intent cameraIntent = createCameraIntent();
            if (cameraIntent != null) {
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
            }
        }

        try {
            startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
        } catch (ActivityNotFoundException ex) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
                filePathCallback = null;
            }
        }
    }

    @Nullable
    private Intent createCameraIntent() {
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (intent.resolveActivity(getPackageManager()) == null) return null;
        try {
            File imageFile = File.createTempFile("aido-upload-", ".jpg", getCacheDir());
            cameraCaptureUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", imageFile);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraCaptureUri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return intent;
        } catch (IOException ignored) {
            return null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;

        Uri[] results = null;
        if (resultCode == RESULT_OK) {
            if (data == null || data.getData() == null) {
                if (cameraCaptureUri != null) results = new Uri[]{cameraCaptureUri};
            } else if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) {
                    results[i] = data.getClipData().getItemAt(i).getUri();
                }
            } else {
                results = new Uri[]{data.getData()};
            }
        }
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
        cameraCaptureUri = null;
    }
}
