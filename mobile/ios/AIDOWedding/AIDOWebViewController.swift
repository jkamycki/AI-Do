import UIKit
import WebKit

final class AIDOWebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let homeURL = URL(string: "https://aidowedding.net")!
    private let allowedHost = "aidowedding.net"

    private lazy var webView: WKWebView = {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        view.uiDelegate = self
        view.allowsBackForwardNavigationGestures = true
        view.scrollView.refreshControl = refreshControl
        view.scrollView.keyboardDismissMode = .interactive
        view.customUserAgent = "AIDO-iOS-WebView"
        return view
    }()

    private let refreshControl = UIRefreshControl()
    private let spinner = UIActivityIndicatorView(style: .large)
    private let backButton = UIButton(type: .system)
    private let errorView = UIView()
    private let errorLabel = UILabel()
    private let retryButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        configureWebView()
        configureLoadingSpinner()
        configureBackButton()
        configureErrorView()
        loadHome()
    }

    private func configureWebView() {
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        refreshControl.addTarget(self, action: #selector(refreshPage), for: .valueChanged)
    }

    private func configureLoadingSpinner() {
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.hidesWhenStopped = true
        view.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }

    private func configureBackButton() {
        backButton.translatesAutoresizingMaskIntoConstraints = false
        backButton.setTitle("Back", for: .normal)
        backButton.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
        backButton.backgroundColor = UIColor.systemBackground.withAlphaComponent(0.92)
        backButton.layer.cornerRadius = 18
        backButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
        backButton.addTarget(self, action: #selector(goBack), for: .touchUpInside)
        backButton.isHidden = true
        view.addSubview(backButton)
        NSLayoutConstraint.activate([
            backButton.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 12),
            backButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 10)
        ])
    }

    private func configureErrorView() {
        errorView.translatesAutoresizingMaskIntoConstraints = false
        errorView.backgroundColor = .systemBackground
        errorView.isHidden = true

        errorLabel.translatesAutoresizingMaskIntoConstraints = false
        errorLabel.text = "A.IDO could not load. Check your connection and try again."
        errorLabel.textAlignment = .center
        errorLabel.numberOfLines = 0
        errorLabel.font = .systemFont(ofSize: 17, weight: .medium)

        retryButton.translatesAutoresizingMaskIntoConstraints = false
        retryButton.setTitle("Retry", for: .normal)
        retryButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        retryButton.addTarget(self, action: #selector(retryLoad), for: .touchUpInside)

        view.addSubview(errorView)
        errorView.addSubview(errorLabel)
        errorView.addSubview(retryButton)
        NSLayoutConstraint.activate([
            errorView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            errorView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            errorView.topAnchor.constraint(equalTo: view.topAnchor),
            errorView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            errorLabel.leadingAnchor.constraint(equalTo: errorView.leadingAnchor, constant: 28),
            errorLabel.trailingAnchor.constraint(equalTo: errorView.trailingAnchor, constant: -28),
            errorLabel.centerYAnchor.constraint(equalTo: errorView.centerYAnchor, constant: -24),
            retryButton.topAnchor.constraint(equalTo: errorLabel.bottomAnchor, constant: 18),
            retryButton.centerXAnchor.constraint(equalTo: errorView.centerXAnchor)
        ])
    }

    private func loadHome() {
        errorView.isHidden = true
        webView.load(URLRequest(url: homeURL, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 30))
    }

    @objc private func refreshPage() {
        errorView.isHidden = true
        webView.reload()
    }

    @objc private func retryLoad() {
        loadHome()
    }

    @objc private func goBack() {
        if webView.canGoBack {
            webView.goBack()
        }
    }

    private func updateBackButton() {
        backButton.isHidden = !webView.canGoBack
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        spinner.startAnimating()
        errorView.isHidden = true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        spinner.stopAnimating()
        refreshControl.endRefreshing()
        updateBackButton()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showLoadError()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showLoadError()
    }

    private func showLoadError() {
        spinner.stopAnimating()
        refreshControl.endRefreshing()
        updateBackButton()
        errorView.isHidden = false
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if url.scheme == "tel" || url.scheme == "mailto" || url.scheme == "sms" {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        if let host = url.host?.lowercased(), host == allowedHost || host.hasSuffix(".\(allowedHost)") {
            decisionHandler(.allow)
            return
        }

        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }

    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        let host = origin.host.lowercased()
        decisionHandler(host == allowedHost || host.hasSuffix(".\(allowedHost)") ? .grant : .deny)
    }
}
