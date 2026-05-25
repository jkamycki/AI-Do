import UIKit
import WebKit

enum AIDoTheme {
    static let blush = UIColor(red: 247 / 255, green: 221 / 255, blue: 226 / 255, alpha: 1)
    static let gold = UIColor(red: 212 / 255, green: 163 / 255, blue: 115 / 255, alpha: 1)
    static let ink = UIColor(red: 52 / 255, green: 37 / 255, blue: 43 / 255, alpha: 1)
    static let muted = UIColor(red: 112 / 255, green: 97 / 255, blue: 103 / 255, alpha: 1)
}

final class WeddingWebViewController: UIViewController, WKNavigationDelegate {
    private let homeURL = URL(string: "https://aidowedding.net/")!
    private let vendorsURL = URL(string: "https://aidowedding.net/vendors")!
    private let addURL = URL(string: "https://aidowedding.net/aria")!
    private let checklistURL = URL(string: "https://aidowedding.net/checklist")!
    private let moreURL = URL(string: "https://aidowedding.net/settings")!
    private let internalHost = "aidowedding.net"

    private let webView = WeddingWebViewController.makeWebView()
    private let topBar = UIView()
    private let bottomBar = UIStackView()
    private let addButton = UIButton(type: .system)
    private let splashView = UIView()
    private let splashLogo = UIImageView(image: UIImage(named: "Logo"))

    private lazy var homeTab = TabButton(title: "Home", symbol: "house.fill")
    private lazy var vendorsTab = TabButton(title: "Vendors", symbol: "storefront.fill")
    private lazy var checklistTab = TabButton(title: "Checklist", symbol: "checklist")
    private lazy var moreTab = TabButton(title: "More", symbol: "ellipsis.circle.fill")

    private var activeURL: URL?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white
        configureWebView()
        buildTopBar()
        buildWebView()
        buildBottomBar()
        buildSplash()
        navigate(to: homeURL, force: true)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        UIView.animate(withDuration: 0.32, delay: 0.12, options: [.curveEaseOut]) {
            self.splashLogo.alpha = 1
            self.splashLogo.transform = .identity
        } completion: { _ in
            UIView.animate(withDuration: 0.48, delay: 0.42, options: [.curveEaseInOut]) {
                self.splashView.alpha = 0
            } completion: { _ in
                self.splashView.removeFromSuperview()
            }
        }
    }

    private func configureWebView() {
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .white
    }

    private static func makeWebView() -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true
        configuration.websiteDataStore = .default()
        return WKWebView(frame: .zero, configuration: configuration)
    }

    private func buildTopBar() {
        topBar.translatesAutoresizingMaskIntoConstraints = false
        topBar.backgroundColor = .white
        topBar.layer.shadowColor = UIColor.black.cgColor
        topBar.layer.shadowOpacity = 0.05
        topBar.layer.shadowRadius = 10
        topBar.layer.shadowOffset = CGSize(width: 0, height: 3)
        view.addSubview(topBar)

        let logo = UIImageView(image: UIImage(named: "Logo"))
        logo.contentMode = .scaleAspectFit
        logo.translatesAutoresizingMaskIntoConstraints = false

        let profileButton = UIButton(type: .system)
        profileButton.translatesAutoresizingMaskIntoConstraints = false
        profileButton.setImage(UIImage(systemName: "person.crop.circle"), for: .normal)
        profileButton.tintColor = AIDoTheme.gold
        profileButton.backgroundColor = .white
        profileButton.layer.cornerRadius = 21
        profileButton.layer.borderColor = AIDoTheme.blush.cgColor
        profileButton.layer.borderWidth = 1
        profileButton.layer.shadowColor = UIColor.black.cgColor
        profileButton.layer.shadowOpacity = 0.08
        profileButton.layer.shadowRadius = 8
        profileButton.layer.shadowOffset = CGSize(width: 0, height: 3)

        let accent = UIView()
        accent.translatesAutoresizingMaskIntoConstraints = false
        accent.backgroundColor = AIDoTheme.blush

        topBar.addSubview(logo)
        topBar.addSubview(profileButton)
        topBar.addSubview(accent)

        NSLayoutConstraint.activate([
            topBar.topAnchor.constraint(equalTo: view.topAnchor),
            topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            topBar.heightAnchor.constraint(equalToConstant: 92),

            logo.leadingAnchor.constraint(equalTo: topBar.leadingAnchor, constant: 18),
            logo.bottomAnchor.constraint(equalTo: topBar.bottomAnchor, constant: -12),
            logo.widthAnchor.constraint(equalToConstant: 118),
            logo.heightAnchor.constraint(equalToConstant: 46),

            profileButton.trailingAnchor.constraint(equalTo: topBar.trailingAnchor, constant: -18),
            profileButton.centerYAnchor.constraint(equalTo: logo.centerYAnchor),
            profileButton.widthAnchor.constraint(equalToConstant: 42),
            profileButton.heightAnchor.constraint(equalToConstant: 42),

            accent.leadingAnchor.constraint(equalTo: topBar.leadingAnchor),
            accent.trailingAnchor.constraint(equalTo: topBar.trailingAnchor),
            accent.bottomAnchor.constraint(equalTo: topBar.bottomAnchor),
            accent.heightAnchor.constraint(equalToConstant: 1)
        ])
    }

    private func buildWebView() {
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: topBar.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -88)
        ])
    }

    private func buildBottomBar() {
        let bottomContainer = UIView()
        bottomContainer.translatesAutoresizingMaskIntoConstraints = false
        bottomContainer.backgroundColor = .clear
        view.addSubview(bottomContainer)

        bottomBar.translatesAutoresizingMaskIntoConstraints = false
        bottomBar.axis = .horizontal
        bottomBar.alignment = .center
        bottomBar.distribution = .fillEqually
        bottomBar.spacing = 6
        bottomBar.backgroundColor = .white
        bottomBar.layer.cornerRadius = 30
        bottomBar.layer.shadowColor = UIColor.black.cgColor
        bottomBar.layer.shadowOpacity = 0.12
        bottomBar.layer.shadowRadius = 18
        bottomBar.layer.shadowOffset = CGSize(width: 0, height: 8)
        bottomBar.isLayoutMarginsRelativeArrangement = true
        bottomBar.layoutMargins = UIEdgeInsets(top: 7, left: 10, bottom: 7, right: 10)

        homeTab.addTarget(self, action: #selector(openHome), for: .touchUpInside)
        vendorsTab.addTarget(self, action: #selector(openVendors), for: .touchUpInside)
        checklistTab.addTarget(self, action: #selector(openChecklist), for: .touchUpInside)
        moreTab.addTarget(self, action: #selector(openMore), for: .touchUpInside)

        let spacer = UIView()
        spacer.translatesAutoresizingMaskIntoConstraints = false
        bottomBar.addArrangedSubview(homeTab)
        bottomBar.addArrangedSubview(vendorsTab)
        bottomBar.addArrangedSubview(spacer)
        bottomBar.addArrangedSubview(checklistTab)
        bottomBar.addArrangedSubview(moreTab)

        addButton.translatesAutoresizingMaskIntoConstraints = false
        addButton.setImage(UIImage(systemName: "plus"), for: .normal)
        addButton.tintColor = .white
        addButton.backgroundColor = UIColor(red: 141 / 255, green: 61 / 255, blue: 88 / 255, alpha: 1)
        addButton.layer.cornerRadius = 31
        addButton.layer.shadowColor = UIColor.black.cgColor
        addButton.layer.shadowOpacity = 0.22
        addButton.layer.shadowRadius = 14
        addButton.layer.shadowOffset = CGSize(width: 0, height: 8)
        addButton.addTarget(self, action: #selector(openAdd), for: .touchUpInside)

        bottomContainer.addSubview(bottomBar)
        bottomContainer.addSubview(addButton)

        NSLayoutConstraint.activate([
            bottomContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            bottomContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
            bottomContainer.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -8),
            bottomContainer.heightAnchor.constraint(equalToConstant: 82),

            bottomBar.leadingAnchor.constraint(equalTo: bottomContainer.leadingAnchor),
            bottomBar.trailingAnchor.constraint(equalTo: bottomContainer.trailingAnchor),
            bottomBar.bottomAnchor.constraint(equalTo: bottomContainer.bottomAnchor),
            bottomBar.heightAnchor.constraint(equalToConstant: 70),

            spacer.widthAnchor.constraint(equalToConstant: 66),

            addButton.centerXAnchor.constraint(equalTo: bottomContainer.centerXAnchor),
            addButton.topAnchor.constraint(equalTo: bottomContainer.topAnchor),
            addButton.widthAnchor.constraint(equalToConstant: 62),
            addButton.heightAnchor.constraint(equalToConstant: 62)
        ])
    }

    private func buildSplash() {
        splashView.translatesAutoresizingMaskIntoConstraints = false
        splashView.backgroundColor = .white
        view.addSubview(splashView)

        splashLogo.translatesAutoresizingMaskIntoConstraints = false
        splashLogo.contentMode = .scaleAspectFit
        splashLogo.alpha = 0
        splashLogo.transform = CGAffineTransform(scaleX: 0.96, y: 0.96)
        splashView.addSubview(splashLogo)

        NSLayoutConstraint.activate([
            splashView.topAnchor.constraint(equalTo: view.topAnchor),
            splashView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splashView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            splashView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            splashLogo.centerXAnchor.constraint(equalTo: splashView.centerXAnchor),
            splashLogo.centerYAnchor.constraint(equalTo: splashView.centerYAnchor),
            splashLogo.widthAnchor.constraint(equalToConstant: 190),
            splashLogo.heightAnchor.constraint(equalToConstant: 190)
        ])
    }

    private func navigate(to url: URL, force: Bool = false) {
        guard force || !sameDestination(activeURL, url) else { return }
        activeURL = url
        updateActiveTab(for: url)
        UIView.animate(withDuration: 0.12) {
            self.webView.alpha = 0.88
        } completion: { _ in
            self.webView.load(URLRequest(url: url))
        }
    }

    private func sameDestination(_ current: URL?, _ target: URL) -> Bool {
        guard let current else { return false }
        return isInternal(current) && normalizedPath(current) == normalizedPath(target)
    }

    private func normalizedPath(_ url: URL) -> String {
        let path = url.path.isEmpty ? "/" : url.path
        return path
    }

    private func isInternal(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return host == internalHost || host.hasSuffix("." + internalHost)
    }

    private func updateActiveTab(for url: URL) {
        let path = normalizedPath(url)
        homeTab.isActive = path == "/"
        vendorsTab.isActive = path.hasPrefix("/vendors")
        checklistTab.isActive = path.hasPrefix("/checklist")
        moreTab.isActive = path.hasPrefix("/settings") || path.hasPrefix("/more")
        addButton.backgroundColor = path.hasPrefix("/aria") ? AIDoTheme.gold : UIColor(red: 141 / 255, green: 61 / 255, blue: 88 / 255, alpha: 1)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        activeURL = webView.url
        if let url = webView.url {
            updateActiveTab(for: url)
        }
        UIView.animate(withDuration: 0.18) {
            webView.alpha = 1
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if isInternal(url) {
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    @objc private func openHome() {
        navigate(to: homeURL)
    }

    @objc private func openVendors() {
        navigate(to: vendorsURL)
    }

    @objc private func openAdd() {
        navigate(to: addURL)
    }

    @objc private func openChecklist() {
        navigate(to: checklistURL)
    }

    @objc private func openMore() {
        navigate(to: moreURL)
    }
}

final class TabButton: UIControl {
    var isActive = false {
        didSet { updateAppearance(animated: true) }
    }

    private let imageView = UIImageView()
    private let label = UILabel()

    init(title: String, symbol: String) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        accessibilityLabel = title

        let image = UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 21, weight: .semibold))
        imageView.image = image
        imageView.contentMode = .scaleAspectFit
        imageView.translatesAutoresizingMaskIntoConstraints = false

        label.text = title
        label.font = .systemFont(ofSize: 11, weight: .semibold)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false

        addSubview(imageView)
        addSubview(label)

        NSLayoutConstraint.activate([
            imageView.centerXAnchor.constraint(equalTo: centerXAnchor),
            imageView.topAnchor.constraint(equalTo: topAnchor, constant: 9),
            imageView.widthAnchor.constraint(equalToConstant: 25),
            imageView.heightAnchor.constraint(equalToConstant: 25),

            label.topAnchor.constraint(equalTo: imageView.bottomAnchor, constant: 2),
            label.leadingAnchor.constraint(equalTo: leadingAnchor),
            label.trailingAnchor.constraint(equalTo: trailingAnchor),
            label.heightAnchor.constraint(equalToConstant: 16)
        ])

        updateAppearance(animated: false)
    }

    required init?(coder: NSCoder) {
        return nil
    }

    override var isHighlighted: Bool {
        didSet {
            UIView.animate(withDuration: 0.12) {
                self.transform = self.isHighlighted ? CGAffineTransform(scaleX: 0.96, y: 0.96) : .identity
            }
        }
    }

    private func updateAppearance(animated: Bool) {
        let color = isActive ? AIDoTheme.blush : AIDoTheme.muted
        let changes = {
            self.imageView.tintColor = color
            self.label.textColor = color
            self.transform = self.isActive ? CGAffineTransform(scaleX: 1.04, y: 1.04) : .identity
        }
        if animated {
            UIView.animate(withDuration: 0.16, animations: changes)
        } else {
            changes()
        }
    }
}
