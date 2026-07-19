import Foundation
import SwiftUI

// MARK: - Response wrappers

private struct TRPCResponse<T: Decodable>: Decodable {
    let result: TRPCResult<T>
}

private struct TRPCResult<T: Decodable>: Decodable {
    let data: T
}

// MARK: - DTOs

struct StreamUrls: Decodable {
    let httpMp3128Url: String

    private enum CodingKeys: String, CodingKey {
        case httpMp3128Url = "http_mp3_128_url"
    }
}

struct PaletteSwatch: Decodable, Equatable {
    let name: String
    let rgb: [Double]
    let hsl: [Double]
}

struct AccentColor: Decodable, Equatable {
    let rgb: [Double]
    let hsl: [Double]
    /// Every swatch the server's extraction produced (Vibrant, DarkVibrant,
    /// …), for auditioning alternatives to the default pick. Optional because
    /// older server responses predate the field.
    let palette: [PaletteSwatch]?

    /// This accent with a different extraction swatch substituted in; falls
    /// back to the server's default pick when the name is missing from this
    /// episode's palette (or nil).
    func withSwatch(named name: String?) -> AccentColor {
        guard let name,
              let swatch = palette?.first(where: { $0.name == name })
        else { return self }
        return AccentColor(rgb: swatch.rgb, hsl: swatch.hsl, palette: palette)
    }

    /// The swatch this app uses: Vibrant — richer against the dark UI than
    /// the server's DarkVibrant default, which is tuned for the web's white
    /// surroundings. Falls back to the server's pick for responses without
    /// palette data.
    var appSwatch: AccentColor { withSwatch(named: "Vibrant") }

    /// The swatch exactly as extracted — what the web paints the episode
    /// sheet with (`bg-accent`).
    var raw: Color {
        color { $0 }
    }

    /// Whether dark text reads better than white on this swatch
    /// (perceived-luminance threshold on the raw RGB).
    var prefersDarkText: Bool {
        guard rgb.count >= 3 else { return false }
        let luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
        return luminance > 150
    }

    /// The swatch roughly as the web uses it, for accent elements on light
    /// surfaces (the white FAB pill). The server extracts a dark-leaning
    /// swatch (DarkVibrant) precisely so it reads well against white and can
    /// host white text; the cap keeps unusual artwork from breaking that.
    var onLight: Color {
        color { min($0, 0.45) }
    }

    /// The same thinking mirrored for this app's black surfaces: keep the
    /// swatch's hue and saturation but lift lightness into a range that reads
    /// against black next to near-white text.
    var onDark: Color {
        color { max(0.55, min(0.75, $0)) }
    }

    private func color(lightness clamp: (Double) -> Double) -> Color {
        guard hsl.count >= 3 else { return .black }
        let h = hsl[0]
        let s = hsl[1]
        let l = clamp(hsl[2])
        // Convert HSL → HSB so SwiftUI's Color(hue:saturation:brightness:) can consume it
        let b = l + s * min(l, 1 - l)
        let sHSB = b == 0 ? 0.0 : 2 * (1 - l / b)
        return Color(hue: h, saturation: sHSB, brightness: b)
    }
}

// MARK: - Errors

enum APIError: LocalizedError {
    case badURL
    case invalidResponse(Int)
    case decodingFailed(Error)

    var errorDescription: String? {
        switch self {
        case .badURL:                   return "Invalid URL"
        case .invalidResponse(let c):   return "Server returned \(c)"
        case .decodingFailed(let e):    return "Decode error: \(e.localizedDescription)"
        }
    }
}

// MARK: - Client

final class APIClient {
    static let shared = APIClient()
    private init() {}

    /// Stream URLs are effectively immutable per episode, so cache them for the app session.
    private actor StreamUrlCache {
        private var entries: [String: StreamUrls] = [:]
        func get(_ id: String) -> StreamUrls? { entries[id] }
        func set(_ id: String, _ urls: StreamUrls) { entries[id] = urls }
    }
    private let streamUrlCache = StreamUrlCache()

    private let baseURL = "https://soulector.app/api/trpc"
    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        return URLSession(configuration: config)
    }()

    // MARK: Private helpers

    private func makeURL(procedure: String, input: some Encodable) throws -> URL {
        let data = try JSONEncoder().encode(input)
        let json = String(data: data, encoding: .utf8) ?? "{}"
        var comps = URLComponents(string: "\(baseURL)/\(procedure)")!
        comps.queryItems = [URLQueryItem(name: "input", value: json)]
        guard let url = comps.url else { throw APIError.badURL }
        return url
    }

    private func fetch<T: Decodable>(_ url: URL) async throws -> T {
        let (data, response) = try await session.data(from: url)
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw APIError.invalidResponse(http.statusCode)
        }
        do {
            return try JSONDecoder().decode(TRPCResponse<T>.self, from: data).result.data
        } catch {
            throw APIError.decodingFailed(error)
        }
    }

    // MARK: Public API

    /// Fetches all episodes. Filtering is done client-side so we always pass "all".
    func fetchEpisodes() async throws -> [Episode] {
        let url = try makeURL(procedure: "episodes.all", input: ["collective": "all"])
        return try await fetch(url)
    }

    /// Returns nil when the episode is not found.
    func fetchStreamUrl(episodeId: String) async throws -> StreamUrls? {
        if let cached = await streamUrlCache.get(episodeId) { return cached }
        let url = try makeURL(procedure: "episode.getStreamUrl", input: ["episodeId": episodeId])
        let urls: StreamUrls? = try await fetch(url)
        if let urls { await streamUrlCache.set(episodeId, urls) }
        return urls
    }

    func fetchAccentColor(episodeId: String) async throws -> AccentColor {
        let url = try makeURL(procedure: "episode.getAccentColor", input: ["episodeId": episodeId])
        return try await fetch(url)
    }

    func fetchTracks(episodeId: String) async throws -> [EpisodeTrack] {
        let url = try makeURL(procedure: "episode.getTracks", input: ["episodeId": episodeId])
        return try await fetch(url)
    }

    /// Full search index: every episode across all collectives with its tracks.
    /// The procedure takes no input, so — like the web calling it with
    /// `undefined` — we send no `input` query param at all.
    func fetchSearchIndex() async throws -> [SearchIndexEpisode] {
        guard let url = URL(string: "\(baseURL)/episodes.searchIndex") else { throw APIError.badURL }
        return try await fetch(url)
    }
}
