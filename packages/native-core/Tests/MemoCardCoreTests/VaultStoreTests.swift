import XCTest
import ImageIO
import UniformTypeIdentifiers
@testable import MemoCardCore

final class VaultStoreTests: XCTestCase {
    func testInlineTagGrammarExcludesMarkdownSyntax() {
        XCTAssertEqual(inlineTags("# 标题\n正文 #工作/项目 #设计 #123 #/bad #bad/ #a//b C#"), ["工作/项目", "设计"])
        XCTAssertEqual(inlineTags("`#code`\n```md\n#fenced\n```\n    #indented\n[链接](#anchor) [#label](url) [[#wiki]] <span title=\"#html\">x</span> $x #math$\n#保留"), ["保留"])
        XCTAssertEqual(inlineTags("```\n#unfinished"), [])
    }

    func testIndependentTitleAndEmptyPageLifecycle() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        var note = try await call(core, "saveNote", ["id": id, "title": "", "body": "", "tags": [], "baseHash": NSNull()])
        let path = note["relativePath"] as? String
        for (title, body) in [("只有标题", ""), ("", "只有正文"), ("", "")] {
            note = try await call(core, "saveNote", ["id": id, "title": title, "body": body, "tags": [], "baseHash": note["contentHash"]!])
            XCTAssertEqual(note["title"] as? String, title)
            XCTAssertEqual(note["body"] as? String, body)
            XCTAssertEqual(note["relativePath"] as? String, path)
            let reopened = try await call(core, "getNote", ["id": id])
            XCTAssertEqual(reopened["title"] as? String, title)
        }
    }

    var temporary: URL!
    var vault: URL!
    var local: URL!

    override func setUpWithError() throws {
        temporary = FileManager.default.temporaryDirectory.appendingPathComponent("MemoCardTests-\(UUID().uuidString)").resolvingSymlinksInPath()
        vault = temporary.appendingPathComponent("vault")
        local = temporary.appendingPathComponent("local")
        try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try FileManager.default.removeItem(at: temporary)
    }

    func store(create: Bool = true) async throws -> VaultStore {
        if create && !FileManager.default.fileExists(atPath: vault.appendingPathComponent(".memocard/vault.json").path) {
            for name in [".memocard", "notes", "assets"] { try FileManager.default.createDirectory(at: vault.appendingPathComponent(name), withIntermediateDirectories: true) }
            try encode(VaultMetadata(formatVersion: 1, vaultId: UUID().uuidString.lowercased())).write(to: vault.appendingPathComponent(".memocard/vault.json"))
        }
        let store = try VaultStore(localDataURL: local)
        try await store.open(url: vault, create: create)
        return store
    }

    func call(_ store: VaultStore, _ operation: String, _ params: [String: Any] = [:]) async throws -> [String: Any] {
        let data = try JSONSerialization.data(withJSONObject: params)
        let result = try await store.perform(operation: operation, params: data)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: result) as? [String: Any])
    }

    func save(_ store: VaultStore, id: String = UUID().uuidString.lowercased(), body: String = "Hello", tags: [String] = [], hash: String? = nil) async throws -> [String: Any] {
        try await call(store, "saveNote", ["id": id, "body": body, "tags": tags, "baseHash": hash as Any? ?? NSNull()])
    }

    func testNestedTagsIncludeDescendantsAndDeduplicateAncestors() async throws {
        let core = try await store()
        let saved = try await save(core, tags: ["工作", "工作/项目/设计", "工作/项目/开发"])
        _ = try await save(core, tags: ["工作室"])
        for tag in ["工作", "工作/项目", "工作/项目/设计"] {
            let page = try await call(core, "queryNotes", ["tags": [tag]])
            let notes = try XCTUnwrap(page["notes"] as? [[String: Any]])
            XCTAssertEqual(notes.count, 1)
            XCTAssertEqual(notes.first?["id"] as? String, saved["id"] as? String)
        }
        let result = try await call(core, "listTags")
        let tags = try XCTUnwrap(result["tags"] as? [[String: Any]])
        for name in ["工作", "工作/项目"] {
            XCTAssertEqual(tags.first { $0["name"] as? String == name }?["count"] as? Int, 1)
        }
    }

    func testRefreshBatchReusesOneSnapshotAndInvalidationReadsExternalChanges() async throws {
        let core = try await store()
        _ = try writeNote(id: UUID().uuidString.lowercased())
        let status = try await call(core, "getStatus")
        let indexedAt = try XCTUnwrap((status["coverage"] as? [String: Any])?["indexedAt"] as? String)
        let firstParseMisses = await core.parseMissCount
        XCTAssertEqual(firstParseMisses, 1)

        let page = try await call(core, "queryNotes")
        let tags = try await call(core, "listTags")
        let folders = try await call(core, "listFolders")
        XCTAssertEqual((page["coverage"] as? [String: Any])?["indexedAt"] as? String, indexedAt)
        XCTAssertEqual((tags["coverage"] as? [String: Any])?["indexedAt"] as? String, indexedAt)
        XCTAssertEqual((folders["coverage"] as? [String: Any])?["indexedAt"] as? String, indexedAt)
        let batchParseMisses = await core.parseMissCount
        XCTAssertEqual(batchParseMisses, 1)

        _ = try writeNote(id: UUID().uuidString.lowercased())
        await core.invalidateSnapshot()
        let refreshed = try await call(core, "queryNotes")
        XCTAssertEqual((refreshed["notes"] as? [[String: Any]])?.count, 2)
        let refreshedParseMisses = await core.parseMissCount
        XCTAssertEqual(refreshedParseMisses, 2)
    }

    func expectCode(_ code: String, _ action: () async throws -> Void, file: StaticString = #filePath, line: UInt = #line) async {
        do {
            try await action()
            XCTFail("Expected \(code)", file: file, line: line)
        } catch let error as VaultError {
            XCTAssertEqual(error.code, code, file: file, line: line)
        } catch { XCTFail("Unexpected error: \(error)", file: file, line: line) }
    }

    func writeNote(id: String, filename: String? = nil, date: String = "2026-09-01T09:00:00Z", body: String = "External", extra: String = "") throws -> URL {
        let url = vault.appendingPathComponent("notes/\(filename ?? id).md")
        let source = "---\nid: \"\(id)\"\ncreatedAt: \"\(date)\"\nupdatedAt: \"\(date)\"\ntags: [\"work\", \"ideas\"]\n\(extra)---\n\(body)"
        try Data(source.utf8).write(to: url)
        return url
    }

    func testNestedFoldersAndDirectoryFilter() async throws {
        let core = try await store()
        try FileManager.default.createDirectory(at: vault.appendingPathComponent("notes/work/empty"), withIntermediateDirectories: true)
        let id = UUID().uuidString.lowercased()
        _ = try writeNote(id: id, filename: "work/note")
        _ = try writeNote(id: UUID().uuidString.lowercased())
        let folders = try await call(core, "listFolders")
        XCTAssertEqual(folders["folders"] as? [String], ["notes", "notes/work", "notes/work/empty"])
        let page = try await call(core, "queryNotes", ["folder": "notes/work"])
        XCTAssertEqual((page["notes"] as? [[String: Any]])?.count, 1)
        let sibling = try await call(core, "queryNotes", ["folder": "notes/wor"])
        XCTAssertEqual((sibling["notes"] as? [[String: Any]])?.count, 0)
        await expectCode("INVALID_PARAMS") { _ = try await self.call(core, "queryNotes", ["folder": "notes/../assets"]) }
    }

    func testSaveReloadAndManifestIdentity() async throws {
        let first = try await store()
        let saved = try await save(first, body: "第一条\n\n**想法**", tags: ["工作"])
        let id = try XCTUnwrap(saved["id"] as? String)
        XCTAssertEqual((saved["contentHash"] as? String)?.count, 64)
        let initialStatus = try await call(first, "getStatus")
        let second = try await store(create: false)
        let fetched = try await call(second, "getNote", ["id": id])
        XCTAssertEqual(fetched["body"] as? String, "第一条\n\n**想法**")
        XCTAssertEqual(fetched["contentHash"] as? String, saved["contentHash"] as? String)
        let status = try await call(second, "getStatus")
        XCTAssertEqual(status["vaultId"] as? String, initialStatus["vaultId"] as? String)
        XCTAssertEqual(status["phase"] as? String, "M1")
        XCTAssertEqual(status["syncState"] as? String, "localReadComplete")
        XCTAssertEqual((status["coverage"] as? [String: Any])?["complete"] as? Bool, true)
    }

    func testUnknownYAMLAndExternalRenameSurviveSave() async throws {
        let store = try await store()
        let id = UUID().uuidString.lowercased()
        let original = try writeNote(id: id, extra: "custom:\n  rating: 3\n  links: [\"one\", \"two\"]\n")
        let renamed = vault.appendingPathComponent("notes/renamed externally.md")
        try FileManager.default.moveItem(at: original, to: renamed)
        let fetched = try await call(store, "getNote", ["id": id])
        XCTAssertEqual(fetched["relativePath"] as? String, "notes/renamed externally.md")
        let saved = try await save(store, id: id, body: "Updated", hash: fetched["contentHash"] as? String)
        XCTAssertEqual(saved["createdAt"] as? String, "2026-09-01T09:00:00Z")
        let result = try String(contentsOf: renamed, encoding: .utf8)
        XCTAssertTrue(result.contains("custom:"))
        XCTAssertTrue(result.contains("rating: 3"))
        XCTAssertTrue(result.contains("one"))
        XCTAssertTrue(result.contains("two"))
        XCTAssertFalse(FileManager.default.fileExists(atPath: original.path))
    }

    func testStaleHashNeverOverwritesExternalEdit() async throws {
        let store = try await store()
        let saved = try await save(store)
        let id = try XCTUnwrap(saved["id"] as? String)
        let path = vault.appendingPathComponent(saved["relativePath"] as! String)
        let externallyEdited = try String(contentsOf: path, encoding: .utf8) + " externally edited"
        try Data(externallyEdited.utf8).write(to: path)
        await expectCode("HASH_CONFLICT") {
            _ = try await self.save(store, id: id, body: "Overwrite", hash: saved["contentHash"] as? String)
        }
        XCTAssertEqual(try String(contentsOf: path, encoding: .utf8), externallyEdited)
    }

    func testDeletedSourceCannotBeResurrectedFromOldHash() async throws {
        let store = try await store()
        let saved = try await save(store)
        let id = try XCTUnwrap(saved["id"] as? String)
        let path = vault.appendingPathComponent(saved["relativePath"] as! String)
        try FileManager.default.removeItem(at: path)
        await expectCode("NOTE_NOT_FOUND") {
            _ = try await self.save(store, id: id, hash: saved["contentHash"] as? String)
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: path.path))
    }

    func testMalformedIDAndDateYieldIncompleteCoverageWithoutMutatingFiles() async throws {
        let store = try await store()
        let invalidID = try writeNote(id: "../../escape", filename: "bad-id")
        let invalidDate = try writeNote(id: UUID().uuidString.lowercased(), filename: "bad-date", date: "2026-02-30T12:00:00Z")
        let before = try Data(contentsOf: invalidID)
        let page = try await call(store, "queryNotes")
        XCTAssertEqual((page["notes"] as? [Any])?.count, 0)
        let coverage = try XCTUnwrap(page["coverage"] as? [String: Any])
        XCTAssertEqual(coverage["complete"] as? Bool, false)
        XCTAssertEqual(coverage["issues"] as? Int, 2)
        XCTAssertEqual(try Data(contentsOf: invalidID), before)
        XCTAssertTrue(FileManager.default.fileExists(atPath: invalidDate.path))
        await expectCode("SCAN_INCOMPLETE") { _ = try await self.save(store) }
    }

    func testFrontmatterOnlyAndCRLFFilesKeepOriginalByteHash() async throws {
        let store = try await store()
        let id = UUID().uuidString.lowercased()
        let path = try writeNote(id: id, body: "")
        var text = try String(contentsOf: path, encoding: .utf8)
        text.removeLast() // Closing frontmatter delimiter at EOF is valid.
        text = text.replacingOccurrences(of: "\n", with: "\r\n")
        let bytes = Data(text.utf8)
        try bytes.write(to: path)
        let note = try await call(store, "getNote", ["id": id])
        XCTAssertEqual(note["body"] as? String, "")
        XCTAssertEqual(note["contentHash"] as? String, sha256(bytes))
        XCTAssertEqual(try Data(contentsOf: path), bytes)
        XCTAssertThrowsError(try parseDate("2026-09-01T24:00:00Z"))
    }

    func testDuplicateIDsAreBothPreservedAndExcluded() async throws {
        let store = try await store()
        let id = UUID().uuidString.lowercased()
        let first = try writeNote(id: id)
        let second = try writeNote(id: id.uppercased(), filename: "duplicate", body: "Different")
        let page = try await call(store, "queryNotes")
        XCTAssertEqual((page["notes"] as? [Any])?.count, 0)
        XCTAssertEqual((page["coverage"] as? [String: Any])?["issues"] as? Int, 2)
        await expectCode("DUPLICATE_ID") { _ = try await self.call(store, "getNote", ["id": id]) }
        XCTAssertTrue(FileManager.default.fileExists(atPath: first.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: second.path))
    }

    func testQueryLiteralCaseInsensitiveTagsDateOrderingAndPagination() async throws {
        let store = try await store()
        let older = UUID().uuidString.lowercased(), newer = UUID().uuidString.lowercased()
        _ = try writeNote(id: older, date: "2026-09-01T10:00:00Z", body: "Case (literal)")
        _ = try writeNote(id: newer, date: "2026-09-02T10:00:00Z", body: "CASE (literal)")
        let page = try await call(store, "queryNotes", ["query": "case (", "tags": ["work", "ideas"], "limit": 1])
        XCTAssertEqual((page["notes"] as? [[String: Any]])?.first?["id"] as? String, newer)
        let next = try await call(store, "queryNotes", ["query": "case (", "tags": ["work", "ideas"], "limit": 1, "cursor": page["nextCursor"]!])
        XCTAssertEqual((next["notes"] as? [[String: Any]])?.first?["id"] as? String, older)
        let filtered = try await call(store, "queryNotes", ["from": "2026-09-02T00:00:00Z"])
        XCTAssertEqual((filtered["notes"] as? [Any])?.count, 1)
        let beforeBoundary = try await call(store, "queryNotes", ["to": "2026-09-02T10:00:00Z"])
        XCTAssertEqual((beforeBoundary["notes"] as? [[String: Any]])?.map { $0["id"] as? String }, [older])
        XCTAssertTrue(next["nextCursor"] is NSNull)
        let tags = try await call(store, "listTags")
        XCTAssertEqual((tags["tags"] as? [[String: Any]])?.first?["count"] as? Int, 2)
    }

    func testCursorRejectsChangedQueryOrSnapshotAndLimitOver100() async throws {
        let store = try await store()
        _ = try writeNote(id: UUID().uuidString.lowercased(), date: "2026-09-01T10:00:00Z")
        let edited = try writeNote(id: UUID().uuidString.lowercased(), date: "2026-09-02T10:00:00Z")
        let page = try await call(store, "queryNotes", ["limit": 1])
        let cursor = try XCTUnwrap(page["nextCursor"] as? String)
        await expectCode("CURSOR_QUERY_MISMATCH") {
            _ = try await self.call(store, "queryNotes", ["limit": 1, "query": "changed", "cursor": cursor])
        }
        let changed = try String(contentsOf: edited, encoding: .utf8) + " Changed"
        try Data(changed.utf8).write(to: edited)
        await expectCode("STALE_CURSOR") {
            _ = try await self.call(store, "queryNotes", ["limit": 1, "cursor": cursor])
        }
        await expectCode("INVALID_PARAMS") { _ = try await self.call(store, "queryNotes", ["limit": 101]) }
    }

    func testQueryPagesByEncodedByteBudgetWithoutSkippingNotes() async throws {
        let store = try await store()
        let ids = (0..<10).map { _ in UUID().uuidString.lowercased() }.sorted()
        let body = String(repeating: "x", count: 1024 * 1024)
        for id in ids { _ = try writeNote(id: id, body: body) }
        var received: [String] = []
        var cursor: String?
        repeat {
            let params: [String: Any] = cursor.map { ["cursor": $0] } ?? [:]
            let raw = try await store.perform(operation: "queryNotes", params: JSONSerialization.data(withJSONObject: params))
            XCTAssertLessThan(raw.count, 2 * 1024 * 1024 + 2048)
            let page = try XCTUnwrap(JSONSerialization.jsonObject(with: raw) as? [String: Any])
            let notes = try XCTUnwrap(page["notes"] as? [[String: Any]])
            XCTAssertFalse(notes.isEmpty)
            XCTAssertEqual(notes.count, 1)
            XCTAssertTrue(notes.allSatisfy { $0["body"] as? String == body })
            received.append(contentsOf: try notes.map { try XCTUnwrap($0["id"] as? String) })
            cursor = page["nextCursor"] as? String
            if received.count > ids.count { XCTFail("Pagination failed to advance"); break }
        } while cursor != nil
        XCTAssertEqual(received, ids)
    }

    func testEncodedOversizedFirstNoteStillAdvancesToNextPage() async throws {
        let store = try await store()
        let large = UUID().uuidString.lowercased(), small = UUID().uuidString.lowercased()
        // Escaping makes this 1.5-MiB source larger than the two-MiB JSON budget.
        let body = String(repeating: "\"", count: 1536 * 1024)
        _ = try writeNote(id: large, date: "2026-09-02T10:00:00Z", body: body)
        _ = try writeNote(id: small, date: "2026-09-01T10:00:00Z")
        let first = try await call(store, "queryNotes")
        let firstNotes = try XCTUnwrap(first["notes"] as? [[String: Any]])
        XCTAssertEqual(firstNotes.count, 1)
        XCTAssertEqual(firstNotes.first?["id"] as? String, large)
        XCTAssertEqual(firstNotes.first?["body"] as? String, body)
        let cursor = try XCTUnwrap(first["nextCursor"] as? String)
        let next = try await call(store, "queryNotes", ["cursor": cursor])
        XCTAssertEqual((next["notes"] as? [[String: Any]])?.map { $0["id"] as? String }, [small])
        XCTAssertTrue(next["nextCursor"] is NSNull)
    }

    func testDraftsAreDeviceOnlyAndRemainAvailableAfterVaultIsTemporarilyUnavailable() async throws {
        let store = try await store()
        let id = UUID().uuidString.lowercased()
        let input: [String: Any] = ["id": id, "body": "Never lose this", "tags": ["idea"], "baseHash": NSNull()]
        _ = try await call(store, "saveDraft", input)
        let second = try await self.store(create: false)
        let drafts = try await call(second, "getDrafts")
        XCTAssertEqual((drafts["drafts"] as? [[String: Any]])?.first?["body"] as? String, "Never lose this")
        let notes = try FileManager.default.contentsOfDirectory(atPath: vault.appendingPathComponent("notes").path)
        XCTAssertTrue(notes.isEmpty)
        let moved = temporary.appendingPathComponent("temporarily-moved-vault")
        try FileManager.default.moveItem(at: vault, to: moved)
        _ = try await call(store, "saveDraft", input)
        let availableDrafts = try await call(store, "getDrafts")
        XCTAssertEqual((availableDrafts["drafts"] as? [Any])?.count, 1)
    }

    func testSuccessfulSaveRemovesOnlyMatchingCommittedDraft() async throws {
        let store = try await store()
        let id = UUID().uuidString.lowercased()
        let input: [String: Any] = ["id": id, "body": "Commit this draft", "tags": ["idea"], "baseHash": NSNull()]
        _ = try await call(store, "saveDraft", input)
        let saved = try await call(store, "saveNote", input)
        let cleared = try await call(store, "getDrafts")
        XCTAssertEqual((cleared["drafts"] as? [Any])?.count, 0)

        let hash = try XCTUnwrap(saved["contentHash"] as? String)
        _ = try await call(store, "saveDraft", ["id": id, "body": "Newer draft", "tags": [], "baseHash": hash])
        _ = try await save(store, id: id, body: "Different submitted content", hash: hash)
        let retained = try await call(store, "getDrafts")
        XCTAssertEqual((retained["drafts"] as? [[String: Any]])?.first?["body"] as? String, "Newer draft")
    }

    func testDraftRetainsChosenFolderAndDoesNotFallBackToRoot() async throws {
        let store = try await store()
        let id = UUID().uuidString.lowercased()
        _ = try await call(store, "saveDraft", ["id": id, "body": "![image](../../assets/pixel.png)",
            "tags": [], "baseHash": NSNull(), "relativePath": "notes/folder/moved.md"])
        let resumed = try await self.store(create: false)
        let drafts = try await call(resumed, "getDrafts")
        XCTAssertEqual((drafts["drafts"] as? [[String: Any]])?.first?["relativePath"] as? String, "notes/folder/moved.md")
        await expectCode("FOLDER_NOT_FOUND") {
            _ = try await self.call(resumed, "saveNote", ["id": id, "body": "New note", "tags": [],
                "baseHash": NSNull(), "relativePath": "notes/folder/moved.md"])
        }
        XCTAssertFalse(FileManager.default.fileExists(atPath: vault.appendingPathComponent("notes/\(id).md").path))
        try FileManager.default.createDirectory(at: vault.appendingPathComponent("notes/folder"), withIntermediateDirectories: false)
        let saved = try await call(resumed, "saveNote", ["id": id, "body": "New note", "tags": [],
            "baseHash": NSNull(), "relativePath": "notes/folder/moved.md"])
        XCTAssertEqual(saved["relativePath"] as? String, "notes/folder/moved.md")
    }

    func testNewNestedNoteAttachmentAndRejectedPaths() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        try FileManager.default.createDirectory(at: vault.appendingPathComponent("notes/work/project"), withIntermediateDirectories: true)
        let path = "notes/work/project/\(id).md"
        let image = try await call(core, "importAttachment", ["name": "pixel.png", "noteId": id, "notePath": path,
            "base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM3sAAAAASUVORK5CYII="])
        XCTAssertEqual(image["notePath"] as? String, path)
        XCTAssertEqual(image["markdownPath"] as? String, "../../../" + (image["relativePath"] as! String))
        let saved = try await call(core, "saveNote", ["id": id, "body": "![image](\(image["markdownPath"] as! String))", "tags": [], "relativePath": path])
        XCTAssertEqual(saved["relativePath"] as? String, path)
        XCTAssertTrue(FileManager.default.fileExists(atPath: vault.appendingPathComponent(path).path))
        for invalid in ["assets/new.md", "notes/../new.md", "notes/new.txt"] {
            await expectCode("PATH_NOT_ALLOWED") {
                _ = try await self.call(core, "saveNote", ["id": UUID().uuidString.lowercased(), "body": "invalid", "tags": [], "relativePath": invalid])
            }
        }
    }

    func testFailedSaveRetainsLatestDraft() async throws {
        let store = try await store()
        let saved = try await save(store)
        let id = try XCTUnwrap(saved["id"] as? String), hash = try XCTUnwrap(saved["contentHash"] as? String)
        _ = try await call(store, "saveDraft", ["id": id, "body": "Unsaved changes", "tags": [], "baseHash": hash])
        let path = vault.appendingPathComponent(saved["relativePath"] as! String)
        try Data((String(contentsOf: path, encoding: .utf8) + " external change").utf8).write(to: path)
        await expectCode("HASH_CONFLICT") { _ = try await self.save(store, id: id, body: "Unsaved changes", hash: hash) }
        let drafts = try await call(store, "getDrafts")
        XCTAssertEqual((drafts["drafts"] as? [[String: Any]])?.first?["body"] as? String, "Unsaved changes")
    }

    func testSharedBridgeFixtureMatchesActualFilesAndCoreJSON() async throws {
        let package = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let fixtures = package.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("tests/fixtures")
        let fixture = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: fixtures.appendingPathComponent("bridge-v1.json"))) as? [String: Any])
        try FileManager.default.removeItem(at: vault)
        try FileManager.default.copyItem(at: fixtures.appendingPathComponent("vault"), to: vault)
        let store = try await store(create: false)
        let expectedNote = try XCTUnwrap((fixture["note"] as? [String: Any])?["data"] as? [String: Any])
        let actualNote = try await call(store, "getNote", ["id": expectedNote["id"]!])
        XCTAssertTrue(NSDictionary(dictionary: actualNote).isEqual(to: expectedNote))
        var expectedStatus = try XCTUnwrap((fixture["status"] as? [String: Any])?["data"] as? [String: Any])
        var actualStatus = try await call(store, "getStatus")
        var expectedCoverage = try XCTUnwrap(expectedStatus["coverage"] as? [String: Any])
        var actualCoverage = try XCTUnwrap(actualStatus["coverage"] as? [String: Any])
        _ = try parseDate(XCTUnwrap(actualCoverage["indexedAt"] as? String))
        expectedCoverage.removeValue(forKey: "indexedAt"); actualCoverage.removeValue(forKey: "indexedAt")
        expectedStatus["coverage"] = expectedCoverage; actualStatus["coverage"] = actualCoverage
        XCTAssertTrue(NSDictionary(dictionary: actualStatus).isEqual(to: expectedStatus))
        do {
            _ = try await call(store, "getNote", ["id": UUID().uuidString.lowercased()])
            XCTFail("Expected missing-note error")
        } catch let error as VaultError {
            let actualError = try XCTUnwrap(JSONSerialization.jsonObject(with: encode(error)) as? [String: Any])
            let expectedError = try XCTUnwrap((fixture["error"] as? [String: Any])?["error"] as? [String: Any])
            XCTAssertTrue(NSDictionary(dictionary: actualError).isEqual(to: expectedError))
        }
    }

    func testAttachmentImportReturnsRelativePathAndExactCoordinatedBytes() async throws {
        let store = try await store()
        let base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM3sAAAAASUVORK5CYII="
        let result = try await call(store, "importAttachment", ["name": "pixel.png", "base64": base64])
        let path = try XCTUnwrap(result["relativePath"] as? String)
        XCTAssertTrue(path.hasPrefix("assets/"))
        XCTAssertEqual(result["markdownPath"] as? String, "../" + path)
        let bytes = try await store.asset(relativePath: path)
        XCTAssertEqual(bytes, Data(base64Encoded: base64))
        await expectCode("INVALID_ATTACHMENT") {
            _ = try await self.call(store, "importAttachment", ["name": "../outside.png", "base64": base64])
        }
        await expectCode("INVALID_ATTACHMENT") {
            _ = try await self.call(store, "importAttachment", ["name": "not.png", "base64": Data("not image".utf8).base64EncodedString()])
        }
    }

    func testImportedImageReferenceResolvesFromCurrentNestedNotePath() async throws {
        let store = try await store()
        let id = UUID().uuidString.lowercased()
        let original = try writeNote(id: id)
        let nested = vault.appendingPathComponent("notes/folder/deeper/moved.md")
        try FileManager.default.createDirectory(at: nested.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.moveItem(at: original, to: nested)
        let base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM3sAAAAASUVORK5CYII="
        let result = try await call(store, "importAttachment", ["name": "pixel.png", "base64": base64, "noteId": id])
        let markdownPath = try XCTUnwrap(result["markdownPath"] as? String)
        let assetPath = try XCTUnwrap(result["relativePath"] as? String)
        XCTAssertEqual(result["notePath"] as? String, "notes/folder/deeper/moved.md")
        XCTAssertEqual(markdownPath, "../../../" + assetPath)
        let resolved = nested.deletingLastPathComponent().appendingPathComponent(markdownPath).standardizedFileURL
        XCTAssertEqual(resolved, vault.appendingPathComponent(assetPath))
        XCTAssertEqual(try Data(contentsOf: resolved), Data(base64Encoded: base64))
        let newNote = try await call(store, "importAttachment", ["name": "pixel.png", "base64": base64,
            "noteId": UUID().uuidString.lowercased()])
        XCTAssertEqual(newNote["markdownPath"] as? String, "../" + (newNote["relativePath"] as! String))
    }

    func testAttachmentRejectsAmbiguousAndIncompleteNoteLocationBeforeWriting() async throws {
        let store = try await store()
        let id = UUID().uuidString.lowercased()
        _ = try writeNote(id: id)
        let duplicate = try writeNote(id: id, filename: "duplicate")
        let params: [String: Any] = ["name": "pixel.png", "noteId": id,
            "base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM3sAAAAASUVORK5CYII="]
        await expectCode("DUPLICATE_ID") { _ = try await self.call(store, "importAttachment", params) }
        try FileManager.default.removeItem(at: duplicate)
        _ = try writeNote(id: "broken-id", filename: "broken")
        await expectCode("SCAN_INCOMPLETE") { _ = try await self.call(store, "importAttachment", params) }
        XCTAssertTrue(try FileManager.default.contentsOfDirectory(atPath: vault.appendingPathComponent("assets").path).isEmpty)
    }

    func testValidTIFFRejectedBeforeWritingUnsupportedAttachment() async throws {
        let store = try await store()
        let context = try XCTUnwrap(CGContext(data: nil, width: 2, height: 2, bitsPerComponent: 8, bytesPerRow: 8,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        let image = try XCTUnwrap(context.makeImage())
        let bytes = NSMutableData()
        let destination = try XCTUnwrap(CGImageDestinationCreateWithData(bytes, UTType.tiff.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, image, nil)
        XCTAssertTrue(CGImageDestinationFinalize(destination))
        await expectCode("UNSUPPORTED_ATTACHMENT") {
            _ = try await self.call(store, "importAttachment", ["name": "valid.tiff", "base64": (bytes as Data).base64EncodedString()])
        }
        XCTAssertTrue(try FileManager.default.contentsOfDirectory(atPath: vault.appendingPathComponent("assets").path).isEmpty)
    }

    func testPathEscapesAndSymlinksAreRejectedWithoutReadingTheirTargets() async throws {
        let store = try await store()
        await expectCode("INVALID_ID") { _ = try await self.save(store, id: "../../escape") }
        await expectCode("PATH_NOT_ALLOWED") { _ = try await store.asset(relativePath: "assets/../.memocard/vault.json") }
        let outside = temporary.appendingPathComponent("outside.txt")
        try Data("private".utf8).write(to: outside)
        let link = vault.appendingPathComponent("assets/link.png")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: outside)
        await expectCode("SYMLINK_NOT_ALLOWED") { _ = try await store.asset(relativePath: "assets/link.png") }
        let noteLink = vault.appendingPathComponent("notes/link.md")
        try FileManager.default.createSymbolicLink(at: noteLink, withDestinationURL: outside)
        let status = try await call(store, "getStatus")
        XCTAssertEqual((status["coverage"] as? [String: Any])?["complete"] as? Bool, false)
        XCTAssertEqual(try String(contentsOf: outside, encoding: .utf8), "private")
    }

    func testCloseAndFailedOpenDoNotServePreviousVault() async throws {
        let store = try await store()
        await store.close()
        let closedStatus = try await call(store, "getStatus")
        XCTAssertEqual(closedStatus["connected"] as? Bool, false)
        XCTAssertTrue(closedStatus["vaultId"] is NSNull)
        XCTAssertTrue((closedStatus["coverage"] as? [String: Any])?["indexedAt"] is NSNull)
        try await store.open(url: vault, create: false)
        let bad = temporary.appendingPathComponent("empty")
        try FileManager.default.createDirectory(at: bad, withIntermediateDirectories: false)
        try FileManager.default.createDirectory(at: bad.appendingPathComponent(".memocard"), withIntermediateDirectories: false)
        try Data("invalid".utf8).write(to: bad.appendingPathComponent(".memocard/vault.json"))
        await expectCode("INVALID_VAULT") { try await store.open(url: bad, create: false) }
        let failedStatus = try await call(store, "getStatus")
        XCTAssertEqual(failedStatus["connected"] as? Bool, false)
    }

    func testStaleWebBindingCannotWriteOrReadRestoredVaultWithSameIdentity() async throws {
        let store = try VaultStore(localDataURL: local)
        let oldBinding = UUID(), newBinding = UUID()
        _ = try await self.store() // Explicit legacy fixture.
        try await store.open(url: vault, create: true, binding: oldBinding)
        let saved = try await save(store, body: "Original")
        let id = try XCTUnwrap(saved["id"] as? String)
        let restored = temporary.appendingPathComponent("restored")
        try FileManager.default.copyItem(at: vault, to: restored)
        let newAsset = Data("Only in restored directory".utf8)
        try newAsset.write(to: restored.appendingPathComponent("assets/pixel.png"))
        let originalManifest = try Data(contentsOf: vault.appendingPathComponent(".memocard/vault.json"))
        XCTAssertEqual(try Data(contentsOf: restored.appendingPathComponent(".memocard/vault.json")), originalManifest)
        try await store.open(url: restored, create: false, binding: newBinding)
        let noteURL = restored.appendingPathComponent("notes/\(id).md")
        let before = try Data(contentsOf: noteURL)
        let input = try JSONSerialization.data(withJSONObject: ["id": id, "body": "Must not write", "tags": [], "baseHash": saved["contentHash"]!])
        for operation in ["saveNote", "saveDraft", "importAttachment", "getStatus"] {
            await expectCode("UNAUTHORIZED") {
                _ = try await store.perform(operation: operation, params: input, expectedBinding: oldBinding)
            }
        }
        await expectCode("UNAUTHORIZED") { _ = try await store.asset(relativePath: "assets/pixel.png", expectedBinding: oldBinding) }
        XCTAssertEqual(try Data(contentsOf: noteURL), before)
        let drafts = try await call(store, "getDrafts")
        XCTAssertEqual((drafts["drafts"] as? [Any])?.count, 0)
        let image = try await store.asset(relativePath: "assets/pixel.png", expectedBinding: newBinding)
        XCTAssertEqual(image, newAsset)
        _ = try await store.perform(operation: "saveNote", params: input, expectedBinding: newBinding)
        let nativeRead = try await call(store, "getNote", ["id": id])
        XCTAssertEqual(nativeRead["body"] as? String, "Must not write")
    }

    func testCloseAndFailedOpenRevokeExpectedBindingBeforeDispatch() async throws {
        let store = try VaultStore(localDataURL: local)
        let oldBinding = UUID(), reopenedBinding = UUID()
        _ = try await self.store() // Explicit legacy fixture.
        try await store.open(url: vault, create: true, binding: oldBinding)
        await store.close()
        await expectCode("UNAUTHORIZED") {
            _ = try await store.perform(operation: "getStatus", params: Data("{}".utf8), expectedBinding: oldBinding)
        }
        try await store.open(url: vault, create: false, binding: reopenedBinding)
        let invalid = temporary.appendingPathComponent("empty")
        try FileManager.default.createDirectory(at: invalid, withIntermediateDirectories: false)
        try FileManager.default.createDirectory(at: invalid.appendingPathComponent(".memocard"), withIntermediateDirectories: false)
        try Data("invalid".utf8).write(to: invalid.appendingPathComponent(".memocard/vault.json"))
        await expectCode("INVALID_VAULT") { try await store.open(url: invalid, create: false) }
        await expectCode("UNAUTHORIZED") {
            _ = try await store.perform(operation: "getStatus", params: Data("{}".utf8), expectedBinding: reopenedBinding)
        }
        let nativeStatus = try await call(store, "getStatus")
        XCTAssertEqual(nativeStatus["connected"] as? Bool, false)
    }

    func testDeletedNotesExcludedByDefaultAndUnsupportedOperationsFail() async throws {
        let store = try await store()
        _ = try writeNote(id: UUID().uuidString.lowercased(), extra: "deletedAt: \"2026-09-03T00:00:00Z\"\n")
        let active = try await call(store, "queryNotes")
        let deleted = try await call(store, "queryNotes", ["deleted": true])
        XCTAssertEqual((active["notes"] as? [Any])?.count, 0)
        XCTAssertEqual((deleted["notes"] as? [Any])?.count, 1)
        await expectCode("UNSUPPORTED_OPERATION") { _ = try await self.call(store, "restoreBackup") }
    }
}

extension VaultStoreTests {
    func testObsidianSharedFolderPreservesSourceAndTracksRename() async throws {
        let header = "---\r\nid: my-own-id\r\ncreatedAt: yesterday\r\n# Keep this comment\r\naliases: [Example]\r\ntags: [work]\r\n---\r\n"
        let original = vault.appendingPathComponent("Example.md")
        try Data((header + "Original #inline/topic\r\n").utf8).write(to: original)
        let plain = vault.appendingPathComponent("Plain.md")
        try Data("No properties".utf8).write(to: plain)
        let core = try await store(create: false)
        let page = try await call(core, "queryNotes")
        let notes = try XCTUnwrap(page["notes"] as? [[String: Any]])
        XCTAssertEqual((page["coverage"] as? [String: Any])?["complete"] as? Bool, true)
        let note = try XCTUnwrap(notes.first { $0["relativePath"] as? String == "Example.md" })
        let id = try XCTUnwrap(note["id"] as? String)
        XCTAssertEqual(note["tags"] as? [String], ["work", "inline/topic"])
        let saved = try await save(core, id: id, body: "Updated #inline/topic\r\n", tags: ["work", "inline/topic"], hash: note["contentHash"] as? String)
        XCTAssertEqual(try String(contentsOf: original, encoding: .utf8), header + "Updated #inline/topic\r\n")
        let folder = vault.appendingPathComponent("Projects")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
        let moved = folder.appendingPathComponent("Renamed.md")
        try FileManager.default.moveItem(at: original, to: moved)
        let reopened = try await store(create: false)
        let fetched = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual(fetched["relativePath"] as? String, "Projects/Renamed.md")
        try Data((header + "External").utf8).write(to: moved)
        await expectCode("HASH_CONFLICT") { _ = try await self.save(reopened, id: id, body: "Stale", hash: saved["contentHash"] as? String) }
        XCTAssertEqual(try String(contentsOf: moved, encoding: .utf8), header + "External")
        let plainNote = try XCTUnwrap(notes.first { $0["relativePath"] as? String == "Plain.md" })
        _ = try await save(reopened, id: plainNote["id"] as! String, body: "Still plain", hash: plainNote["contentHash"] as? String)
        XCTAssertEqual(try String(contentsOf: plain, encoding: .utf8), "Still plain")
        let link = try await call(reopened, "resolveLink", ["target": "Renamed", "sourcePath": "Plain.md", "wiki": true])
        XCTAssertEqual(link["id"] as? String, id)
        await expectCode("PATH_NOT_ALLOWED") { _ = try await reopened.asset(relativePath: ".obsidian/secret.png") }
    }
}

extension VaultStoreTests {
    func testNewVaultUsesPlainReadableMarkdownAndPreservesEditedProperties() async throws {
        let core = try VaultStore(localDataURL: local)
        try await core.open(url: vault, create: true)
        let id = "11111111-1111-4111-8111-111111111111"
        let saved = try await save(core, id: id, body: "# 我的记录\n\n正文")
        XCTAssertEqual(saved["relativePath"] as? String, "我的记录-11111111.md")
        XCTAssertEqual(try String(contentsOf: vault.appendingPathComponent("我的记录-11111111.md"), encoding: .utf8), "# 我的记录\n\n正文")
        let url = vault.appendingPathComponent("Tags.md")
        try Data("---\r\n# header\r\ntags: [old]\r\ncustom: \"keep spelling\"\r\n---\r\nBody #inline".utf8).write(to: url)
        let page = try await call(core, "queryNotes")
        let note = try XCTUnwrap((page["notes"] as? [[String: Any]])?.first { $0["relativePath"] as? String == "Tags.md" })
        _ = try await save(core, id: note["id"] as! String, body: "Body #inline", tags: ["new", "inline"], hash: note["contentHash"] as? String)
        XCTAssertEqual(try String(contentsOf: url, encoding: .utf8), "---\r\n# header\r\ntags: [\"new\"]\r\ncustom: \"keep spelling\"\r\n---\r\nBody #inline")
    }
}

extension VaultStoreTests {
    func testEditingLastTagsPropertyKeepsClosingDelimiterAndBody() throws {
        let source = "---\ntags:\n- old\n---\nBody"
        let identity = FileIdentity(id: UUID().uuidString.lowercased(), path: "A.md", hash: "", createdAt: timestamp())
        let parsed = try parseObsidianNote(Data(source.utf8), relativePath: "A.md", vaultID: UUID().uuidString, identity: identity, modified: Date())
        let bytes = try encodedObsidianNote(parsed, body: "Body", tags: ["new"])
        XCTAssertEqual(String(data: bytes, encoding: .utf8), "---\ntags: [\"new\"]\n---\nBody")
    }
}
