// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MemoCardCore",
    platforms: [.macOS(.v14), .iOS(.v17)],
    products: [.library(name: "MemoCardCore", targets: ["MemoCardCore"])],
    dependencies: [.package(url: "https://github.com/jpsim/Yams.git", exact: "5.1.3")],
    targets: [
        .target(name: "MemoCardCore", dependencies: ["Yams"]),
        .testTarget(name: "MemoCardCoreTests", dependencies: ["MemoCardCore"])
    ],
    swiftLanguageVersions: [.v5]
)
