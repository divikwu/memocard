// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MemoCardLocalService",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "MemoCardLocalWeb", targets: ["MemoCardLocalWeb"]),
        .executable(name: "memocard", targets: ["memocard"]),
    ],
    targets: [
        .target(name: "MemoCardLocalWeb"),
        .executableTarget(name: "memocard"),
        .testTarget(name: "MemoCardLocalServiceTests", dependencies: ["MemoCardLocalWeb"]),
    ],
    swiftLanguageVersions: [.v5]
)
