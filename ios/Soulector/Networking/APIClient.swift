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

struct AccentColor: Decodable {
    let rgb: [Double]
    let hsl: [Double]

    /// A SwiftUI Color using the HSL values, with lightness boosted into a visible range
    /// so dark album art colors still produce a distinguishable gradient background.
    var swiftUIColor: Color {
        guard hsl.count >= 3 else { return .black }
        let h = hsl[0]
        let s = hsl[1]
        // Clamp lightness: dark colors (< 0.25) get lifted; very bright ones get toned down
        let l = max(0.28, min(0.48, hsl[2]))
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
        let url = try makeURL(procedure: "episode.getStreamUrl", input: ["episodeId": episodeId])
        return try await fetch(url)
    }

    func fetchAccentColor(episodeId: String) async throws -> AccentColor {
        let url = try makeURL(procedure: "episode.getAccentColor", input: ["episodeId": episodeId])
        return try await fetch(url)
    }

    func fetchTracks(episodeId: String) async throws -> [EpisodeTrack] {
        let url = try makeURL(procedure: "episode.getTracks", input: ["episodeId": episodeId])
        return try await fetch(url)
    }
}
