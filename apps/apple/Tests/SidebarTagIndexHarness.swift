import Foundation

@main
struct SidebarTagIndexHarness {
    static func main() {
        switch CommandLine.arguments[1] {
        case "roots":
            let paths: [String?] = [nil, "父/子", "β", "", "父", "🐈/子", "a/\u{301}b"]
            precondition(NativeSidebarTagIndex(paths: paths).roots == [0, 2, 3, 4, 6])
        case "children":
            let paths: [String?] = ["父/二", "父/一/叶", "父", "父/一", "父/", "父子/叶", nil]
            let index = NativeSidebarTagIndex(paths: paths)
            precondition(index.children(of: "父") == [0, 3, 4])
            precondition(index.children(of: "父/一") == [1])
            precondition(index.children(of: nil).isEmpty)
            precondition(index.children(of: "不存在").isEmpty)
        case "orphans-and-duplicates":
            let paths: [String?] = ["缺父/叶", "root", "root/child", "root", "root/child", "/叶", ""]
            let index = NativeSidebarTagIndex(paths: paths)
            precondition(index.roots == [1, 3, 6]) // Missing parents are not synthesized or promoted.
            precondition(index.children(of: "缺父") == [0]) // A pinned orphan can still expand.
            precondition(index.children(of: "root") == [2, 4])
            precondition(index.children(of: "") == [5])
        case "unicode":
            let paths: [String?] = ["é/中文", "e\u{301}/👩🏽‍💻", "é/中文/叶", "e\u{301}", "a/\u{301}b"]
            let index = NativeSidebarTagIndex(paths: paths)
            precondition(index.children(of: "é") == [0, 1])
            precondition(index.children(of: "e\u{301}") == [0, 1])
            precondition(index.children(of: "é/中文") == [2])
            precondition(index.roots == [3, 4])
        case "replacement":
            // Build against each captured current array; indices never outlive a surface update.
            for paths in [["a", "a/b", "a/c"], ["a/c", "a", "a/b"], ["a", "a/c"], [], ["x/y", "x"]] {
                let index = NativeSidebarTagIndex(paths: paths)
                let roots = index.roots.map { paths[$0] }
                precondition(roots == paths.filter { !$0.contains("/") })
                for path in paths {
                    let children = index.children(of: path).map { paths[$0] }
                    precondition(children == legacyChildren(path, paths: paths).map { paths[$0] })
                }
            }
        case "equivalence":
            let segments = ["", "a", "标签", "👩‍💻", "é", "e\u{301}", "\u{301}", "a\u{301}", "/\u{301}", "a/b", "a\u{0}b"]
            var paths: [String?] = [nil, "", "/", "a", "a/", "a//", "orphan/child", "a", "a/b"]
            for first in segments {
                for second in segments {
                    for third in segments { paths.append([first, second, third].joined(separator: "/")) }
                }
            }
            let index = NativeSidebarTagIndex(paths: paths)
            precondition(index.roots == paths.indices.filter { !(paths[$0] ?? "").contains("/") })
            for path in paths {
                precondition(index.children(of: path) == legacyChildren(path, paths: paths), "Changed hierarchy for \(path.debugDescription)")
            }
        default:
            fatalError("Unknown test case")
        }
        print("PASS")
    }

    // Independent reference for the previous native direct-child filter, including Swift String semantics.
    private static func legacyChildren(_ path: String?, paths: [String?]) -> [Int] {
        guard let path else { return [] }
        return paths.indices.filter {
            (paths[$0] ?? "").hasPrefix(path + "/") && !String((paths[$0] ?? "").dropFirst(path.count + 1)).contains("/")
        }
    }
}
