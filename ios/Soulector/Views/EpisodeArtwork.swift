import SwiftUI

/// Episode album art, served from the downloaded copy when there is one so a
/// downloaded episode looks like itself with the network off. Reads the local
/// file directly (rather than handing `AsyncImage` a file URL) so offline art
/// is never at the mercy of the loader's caching.
struct EpisodeArtwork: View {
    let episode: Episode
    var contentMode: ContentMode = .fill

    @EnvironmentObject var downloadsStore: DownloadsStore

    var body: some View {
        if let url = downloadsStore.artworkURL(for: episode.id),
           let image = ArtworkCache.image(at: url) {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: contentMode)
        } else {
            AsyncImage(url: URL(string: episode.artworkUrl)) { phase in
                if case .success(let image) = phase {
                    image.resizable().aspectRatio(contentMode: contentMode)
                } else {
                    placeholder
                }
            }
        }
    }

    private var placeholder: some View {
        Rectangle()
            .fill(Color.gray.opacity(0.3))
            .aspectRatio(1, contentMode: contentMode)
    }
}

/// Keeps decoded local artwork around so scrolling the list doesn't re-read the
/// same files. Bounded — a large downloads folder shouldn't grow memory without
/// end.
private enum ArtworkCache {
    private static let images: NSCache<NSURL, UIImage> = {
        let cache = NSCache<NSURL, UIImage>()
        cache.countLimit = 60
        return cache
    }()

    static func image(at url: URL) -> UIImage? {
        let key = url as NSURL
        if let cached = images.object(forKey: key) { return cached }
        guard let image = UIImage(contentsOfFile: url.path) else { return nil }
        images.setObject(image, forKey: key)
        return image
    }
}
