import Foundation

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
    // API has a typo: "bodyTexColor" instead of "bodyTextColor"
    let bodyTextColor: String
    let titleTextColor: String

    private enum CodingKeys: String, CodingKey {
        case rgb
        case bodyTextColor = "bodyTexColor"
        case titleTextColor
    }

    var color: (r: Double, g: Double, b: Double) {
        guard rgb.count >= 3 else { return (0, 0, 0) }
        return (rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)
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
