import SwiftUI
import UIKit

/// A black box for a sideloaded build.
///
/// There's no console attached to an app installed through SideStore, so when
/// something dies the evidence dies with it. This keeps a rolling trail of what
/// the app was doing on disk, catches the crash on the way out, and hands the
/// whole thing back as text on the next launch — shake the phone to read it.
///
/// Deliberately modest: breadcrumbs plus a reason and a stack. Enough to say
/// *what was happening* when it went, which is the part that's otherwise gone.
enum Diagnostics {
    /// Where the trail and the last crash live. Application Support rather than
    /// Caches — the whole point is surviving the process that wrote it.
    private static let directory: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Diagnostics", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    private static var trailURL: URL { directory.appendingPathComponent("trail.log") }
    private static var crashURL: URL { directory.appendingPathComponent("crash.log") }

    /// Kept in memory as well so the sheet can show the current session's trail
    /// without a read, and bounded so a long listen doesn't grow without end.
    private static var recent: [String] = []
    private static let limit = 300
    private static let queue = DispatchQueue(label: "com.soulector.diagnostics")

    // MARK: Recording

    /// Note something worth seeing in a crash report. Cheap enough to call from
    /// navigation and playback paths; not for per-frame work.
    static func breadcrumb(_ message: String) {
        let line = "\(timestamp()) \(message)"
        queue.async {
            recent.append(line)
            if recent.count > limit { recent.removeFirst(recent.count - limit) }
            append(line + "\n", to: trailURL)
        }
    }

    /// Installs the handlers. Call once, as early as possible.
    static func install() {
        // A previous run's trail is only interesting alongside its crash, and
        // that's already been copied into crash.log by now.
        queue.async { try? FileManager.default.removeItem(at: trailURL) }

        NSSetUncaughtExceptionHandler { exception in
            Diagnostics.record(
                reason: "Uncaught exception: \(exception.name.rawValue) — \(exception.reason ?? "no reason")",
                stack: exception.callStackSymbols
            )
        }

        // Swift's own traps (force unwrap, precondition, a missing
        // EnvironmentObject) arrive as signals rather than exceptions, so they
        // need catching separately or the most common crashes are the ones we
        // learn nothing about.
        for sig in [SIGABRT, SIGILL, SIGSEGV, SIGFPE, SIGBUS, SIGTRAP] {
            signal(sig) { received in
                Diagnostics.record(
                    reason: "Signal \(received)",
                    stack: Thread.callStackSymbols
                )
                // Restore the default and re-raise, so the crash still looks
                // like a crash to the system rather than being swallowed.
                signal(received, SIG_DFL)
                raise(received)
            }
        }

        breadcrumb("app launched")
    }

    /// Writing from a signal handler is not something to be clever in: one
    /// synchronous write of a string we already hold, no allocation-heavy work
    /// beyond the symbols themselves.
    private static func record(reason: String, stack: [String]) {
        let report = ([
            "CRASH \(timestamp())",
            reason,
            "",
            "Last \(min(recent.count, 40)) events:",
        ] + recent.suffix(40) + [
            "",
            "Stack:",
        ] + stack.prefix(30)).joined(separator: "\n")

        try? report.write(to: crashURL, atomically: false, encoding: .utf8)
    }

    // MARK: Reading

    /// The crash from a previous run, if there was one.
    static var lastCrash: String? {
        try? String(contentsOf: crashURL, encoding: .utf8)
    }

    static var hasCrash: Bool { FileManager.default.fileExists(atPath: crashURL.path) }

    /// Everything worth pasting into a bug report.
    static func report() -> String {
        var parts: [String] = []
        parts.append("Soulector diagnostics — \(timestamp())")
        parts.append("iOS \(UIDevice.current.systemVersion) · \(deviceModel())")

        if let crash = lastCrash {
            parts.append("\n=== LAST CRASH ===\n\(crash)")
        } else {
            parts.append("\nNo crash recorded.")
        }

        let trail = queue.sync { recent }
        parts.append("\n=== THIS SESSION ===\n" + (trail.isEmpty ? "(nothing yet)" : trail.joined(separator: "\n")))
        return parts.joined(separator: "\n")
    }

    static func clearCrash() {
        try? FileManager.default.removeItem(at: crashURL)
    }

    // MARK: Bits

    private static func append(_ text: String, to url: URL) {
        guard let data = text.data(using: .utf8) else { return }
        if let handle = try? FileHandle(forWritingTo: url) {
            defer { try? handle.close() }
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: data)
        } else {
            try? data.write(to: url)
        }
    }

    private static func timestamp() -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss.SSS"
        return f.string(from: Date())
    }

    private static func deviceModel() -> String {
        var info = utsname()
        uname(&info)
        let machine = withUnsafePointer(to: &info.machine) {
            $0.withMemoryRebound(to: CChar.self, capacity: 1) { String(validatingUTF8: $0) ?? "?" }
        }
        return machine
    }
}

// MARK: - Shake to open

/// Shake is the entry point because it's the one gesture that can't collide
/// with anything the app already does, and it works from whatever screen just
/// misbehaved — including on top of a sheet.
extension Notification.Name {
    static let deviceDidShake = Notification.Name("com.soulector.deviceDidShake")
}

private final class ShakeSensingController: UIViewController {
    override var canBecomeFirstResponder: Bool { true }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        becomeFirstResponder()
    }

    override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        guard motion == .motionShake else { return }
        NotificationCenter.default.post(name: .deviceDidShake, object: nil)
    }
}

private struct ShakeSensor: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController { ShakeSensingController() }
    func updateUIViewController(_ controller: UIViewController, context: Context) {}
}

extension View {
    /// Puts an invisible first responder behind the content to catch shakes.
    func sensesShake() -> some View {
        background(ShakeSensor().allowsHitTesting(false).frame(width: 0, height: 0))
    }
}

// MARK: - The sheet

struct DiagnosticsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var copied = false

    var body: some View {
        NavigationStack {
            ScrollView {
                Text(text.isEmpty ? "Gathering…" : text)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundColor(.white.opacity(0.85))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
            }
            .background(Color(white: 0.08).ignoresSafeArea())
            .navigationTitle("Diagnostics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") { dismiss() }
                }
                ToolbarItemGroup(placement: .navigationBarTrailing) {
                    if Diagnostics.hasCrash {
                        Button("Clear") {
                            Diagnostics.clearCrash()
                            text = Diagnostics.report()
                        }
                    }
                    Button(copied ? "Copied" : "Copy") {
                        UIPasteboard.general.string = text
                        copied = true
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                    }
                    .font(.app(size: 15, weight: .semibold))
                }
            }
        }
        .task { text = Diagnostics.report() }
    }
}
