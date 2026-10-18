import Foundation

private func fixture(_ count: Int) -> [NativeAction] {
    var tags: [NativeAction] = []
    tags.reserveCapacity(count)
    for i in 0..<count {
        let path = i < 10 ? "分组\(i)" : (tags[(i - 10) / 10].path! + "/标签\(i)")
        tags.append(NativeAction(id: "tag:\(path)", title: "标签\(i)", path: path))
    }
    return tags
}

@inline(never) private func baselineWalk(_ item: NativeAction, tags: [NativeAction]) -> Int {
    1 + BaselineBranch(item: item, tags: tags).children.reduce(0) { $0 + baselineWalk($1, tags: tags) }
}
@inline(never) private func baselineTree(_ tags: [NativeAction]) -> Int {
    baselineRoots(tags).reduce(0) { $0 + baselineWalk($1, tags: tags) }
}
@inline(never) private func indexedWalk(_ item: NativeAction, tags: [NativeAction], index: NativeSidebarTagIndex) -> Int {
    let children = index.children(of: item.path).map { tags[$0] }
    return 1 + children.reduce(0) { $0 + indexedWalk($1, tags: tags, index: index) }
}
@inline(never) private func indexedTree(_ tags: [NativeAction]) -> Int {
    // Include the full production build + map + traversal cost, rather than only dictionary reads.
    let index = NativeSidebarTagIndex(paths: tags.map(\.path))
    return index.roots.map { tags[$0] }.reduce(0) { $0 + indexedWalk($1, tags: tags, index: index) }
}

@main
struct SidebarTagBenchmark {
    static func main() throws {
        for size in [1_000, 5_000, 10_000] {
            let tags = fixture(size)
            var samples = ["baseline": [Double](), "indexed": [Double]()]
            for iteration in -3..<15 {
                // Alternate the order on the same fixture to reduce clock and thermal ordering bias.
                let order = iteration % 2 == 0 ? ["baseline", "indexed"] : ["indexed", "baseline"]
                for variant in order {
                    let start = DispatchTime.now().uptimeNanoseconds
                    let count = variant == "baseline" ? baselineTree(tags) : indexedTree(tags)
                    let elapsed = Double(DispatchTime.now().uptimeNanoseconds - start) / 1_000_000
                    precondition(count == size)
                    if iteration >= 0 { samples[variant, default: []].append(elapsed) }
                }
            }
            var row: [String: Any] = ["tags": size, "warmups": 3, "samples": 15]
            for (variant, values) in samples {
                let sorted = values.sorted()
                row[variant] = ["medianMs": sorted[7], "p95Ms": sorted[14]]
            }
            let output = try JSONSerialization.data(withJSONObject: row, options: [.sortedKeys])
            FileHandle.standardOutput.write(output + Data([10]))
        }
    }
}
