import XCTest
import ImageIO
import UniformTypeIdentifiers
@testable import MemoCardCore

final class VaultStoreTests: XCTestCase {
    func testMCPCreateAndUpdatePreserveMetadataAndRejectStaleOrMissingVersions() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        let created = try await call(core, "createNote", ["id": id, "title": "MCP 新笔记", "body": "初稿 #work"])
        XCTAssertEqual(created["id"] as? String, id)
        XCTAssertEqual(created["body"] as? String, "初稿 #work")
        let path = vault.appendingPathComponent(created["relativePath"] as! String)
        var source = try String(contentsOf: path, encoding: .utf8)
        source = source.replacingOccurrences(of: "---\n", with: "---\ncustom: preserve-me\ntags: [frontmatter]\n", range: source.range(of: "---\n"))
        try Data(source.utf8).write(to: path)
        let current = try await call(core, "getNote", ["id": id])
        let updated = try await call(core, "updateNote", ["id": id, "body": "修改后 #ideas", "baseHash": current["contentHash"]!])
        XCTAssertEqual(updated["body"] as? String, "修改后 #ideas")
        XCTAssertEqual(updated["createdAt"] as? String, created["createdAt"] as? String)
        XCTAssertEqual(updated["relativePath"] as? String, created["relativePath"] as? String)
        XCTAssertTrue(try String(contentsOf: path, encoding: .utf8).contains("custom: preserve-me"))
        XCTAssertEqual(Set(updated["tags"] as! [String]), Set(["frontmatter", "ideas"]))
        let before = try Data(contentsOf: path)
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "updateNote", ["id": id, "title": "Stale rename", "body": "stale", "baseHash": current["contentHash"]!]) }
        await expectCode("INVALID_PARAMS") { _ = try await self.call(core, "updateNote", ["id": id, "body": "missing hash"]) }
        await expectCode("INVALID_ARGUMENT") { _ = try await self.call(core, "updateNote", ["id": id, "body": "empty hash", "baseHash": ""]) }
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "createNote", ["id": id, "body": "must not overwrite"]) }
        XCTAssertEqual(try Data(contentsOf: path), before)
        let renamed = try await call(core, "updateNote", ["id": id, "title": "MCP 改名", "body": "新正文", "baseHash": updated["contentHash"]!])
        XCTAssertNotEqual(renamed["relativePath"] as? String, created["relativePath"] as? String)
        let missing = UUID().uuidString.lowercased()
        await expectCode("NOTE_NOT_FOUND") { _ = try await self.call(core, "updateNote", ["id": missing, "body": "no resurrection", "baseHash": updated["contentHash"]!]) }
        _ = try await call(core, "deleteNote", ["id": id, "baseHash": renamed["contentHash"]!])
        await expectCode("NOTE_NOT_FOUND") { _ = try await self.call(core, "updateNote", ["id": id, "body": "deleted", "baseHash": renamed["contentHash"]!]) }
        let generated = try await call(core, "createNote", ["body": "Generated ID"])
        XCTAssertNotNil(UUID(uuidString: generated["id"] as! String))
    }

    func testMCPWritesUseTheObsidianSavePathAndPreserveFrontmatter() async throws {
        let path = vault.appendingPathComponent("Existing.md")
        try Data("---\ncustom: keep\ntags: [existing]\n---\nOriginal".utf8).write(to: path)
        let core = try await store(create: false)
        let original = (try await call(core, "queryNotes")["notes"] as! [[String: Any]])[0]
        let saved = try await call(core, "updateNote", ["id": original["id"]!, "body": "Edited #inline", "baseHash": original["contentHash"]!])
        XCTAssertEqual(saved["relativePath"] as? String, "Existing.md")
        XCTAssertEqual(Set(saved["tags"] as! [String]), Set(["existing", "inline"]))
        XCTAssertTrue(try String(contentsOf: path, encoding: .utf8).contains("custom: keep"))
        let id = UUID().uuidString.lowercased()
        let created = try await call(core, "createNote", ["id": id, "title": "New Markdown", "body": "Created"])
        XCTAssertEqual(created["relativePath"] as? String, "New Markdown.md")
        let read = try await call(core, "getNote", ["id": id])
        XCTAssertEqual(read["contentHash"] as? String, created["contentHash"] as? String)
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "createNote", ["id": id, "body": "duplicate"]) }
    }

    func testCaptureOperationsRejectAnotherVaultOrDirectoryBindingBeforeMutation() async throws {
        let core = try await store()
        for operation in ["getNote", "createNote", "updateNote", "saveNote", "saveDraft", "deleteDraft", "deleteNote", "getTrash", "getTrashedNote", "restoreNote", "permanentlyDeleteNote", "importAttachment"] {
            await expectCode("VAULT_CHANGED") { _ = try await self.call(core, operation, ["vaultId": "other-vault"]) }
            await expectCode("UNAUTHORIZED") { _ = try await self.call(core, operation, ["vaultBinding": UUID().uuidString.lowercased()]) }
        }
        let notes = try await call(core, "queryNotes")["notes"] as! [[String: Any]]
        let drafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertTrue(notes.isEmpty)
        XCTAssertTrue(drafts.isEmpty)
    }

    func testTagPreferencesAreSharedAcrossIndependentClientsAndDetectConflicts() async throws {
        let core = try await store()
        let initial = try await call(core, "getTagPreferences")
        XCTAssertEqual(initial["initialized"] as? Bool, false)
        let saved = try await call(core, "setTagPreferences", ["pinned":["area/coffee"], "icons":["area/coffee":"☕", "area/ai":"🧑🏽‍💻"], "baseHash":initial["contentHash"]!])
        let other = try VaultStore(localDataURL: temporary.appendingPathComponent("independent-tag-client"))
        try await other.open(url: vault, create: false)
        let loaded = try await call(other, "getTagPreferences")
        XCTAssertEqual(loaded["pinned"] as? [String], ["area/coffee"])
        XCTAssertEqual(loaded["icons"] as? [String:String], ["area/coffee":"☕", "area/ai":"🧑🏽‍💻"])
        await expectCode("HASH_CONFLICT") { _ = try await self.call(other, "setTagPreferences", ["pinned":[], "icons":[:], "baseHash":initial["contentHash"]!]) }
        _ = try await call(other, "setTagPreferences", ["pinned":[], "icons":[:], "baseHash":saved["contentHash"]!])
        let empty = try await call(core, "getTagPreferences")
        XCTAssertEqual(empty["initialized"] as? Bool, true)
        XCTAssertEqual(empty["pinned"] as? [String], [])
        await expectCode("VAULT_CHANGED") { _ = try await self.call(core, "getTagPreferences", ["vaultId":"wrong-vault"]) }
    }

    func testTagPreferencesRejectInvalidAndCorruptSettingsWithoutOverwriting() async throws {
        let core = try await store()
        let initial = try await call(core, "getTagPreferences")
        for input: [String:Any] in [["pinned":["area\ncoffee"], "icons":[:]], ["pinned":["AREA/COFFEE"], "icons":[:]], ["pinned":[], "icons":["area/coffee":String(repeating:"x",count:33)]]] {
            var params = input; params["baseHash"] = initial["contentHash"]!
            await expectCode("INVALID_TAG_PREFERENCES") { _ = try await self.call(core,"setTagPreferences",params) }
        }
        let path = vault.appendingPathComponent(".memocard/tag-preferences.json")
        try Data("{broken".utf8).write(to:path)
        await expectCode("INVALID_TAG_PREFERENCES") { _ = try await self.call(core,"getTagPreferences") }
        await expectCode("INVALID_TAG_PREFERENCES") { _ = try await self.call(core,"setTagPreferences",["pinned":[],"icons":[:],"baseHash":initial["contentHash"]!]) }
        XCTAssertEqual(try String(contentsOf:path,encoding:.utf8),"{broken")
    }

    func testTagPreferencesRecoverAnEmptyFileFromAnInterruptedBrowserWrite() async throws {
        let core = try await store()
        try Data().write(to: vault.appendingPathComponent(".memocard/tag-preferences.json"))
        let initial = try await call(core, "getTagPreferences")
        XCTAssertEqual(initial["initialized"] as? Bool, false)
        let saved = try await call(core, "setTagPreferences", ["pinned":["work"], "icons":[:], "baseHash":initial["contentHash"]!])
        XCTAssertEqual(saved["pinned"] as? [String], ["work"])
        XCTAssertEqual(saved["initialized"] as? Bool, true)
    }

    func testMarkdownPinsAreSharedAcrossLocalIdentitiesAndFollowTransactionalRenames() async throws {
        let source = vault.appendingPathComponent("Original.md")
        try Data("Body".utf8).write(to: source)
        let core = try await store(create: false)
        let note = (try await call(core, "queryNotes")["notes"] as! [[String: Any]])[0]
        let initial = try await call(core, "getNotePins")
        let pinned = try await call(core, "setNotePinned", ["id": note["id"]!, "pinned": true, "baseHash": initial["contentHash"]!])
        let other = try VaultStore(localDataURL: temporary.appendingPathComponent("other-local"))
        try await other.open(url: vault, create: false)
        let otherNote = (try await call(other, "queryNotes")["notes"] as! [[String: Any]])[0]
        XCTAssertNotEqual(note["id"] as? String, otherNote["id"] as? String)
        let state = try await call(other, "getNotePins")
        XCTAssertEqual((state["pins"] as? [String: String])?[otherNote["id"] as! String], (pinned["pins"] as? [String: String])?[note["id"] as! String])
        let renamed = try await call(other, "saveNote", ["id": otherNote["id"]!, "title": "Renamed", "body": "Edited", "tags": [], "baseHash": otherNote["contentHash"]!])
        let fresh = try VaultStore(localDataURL: temporary.appendingPathComponent("fresh-local"))
        try await fresh.open(url: vault, create: false)
        let list = try await call(fresh, "queryNotes", ["pinned": true, "sort": "pinnedAt"])["notes"] as! [[String: Any]]
        XCTAssertEqual(list.count, 1)
        XCTAssertEqual(list.first?["relativePath"] as? String, renamed["relativePath"] as? String)
        XCTAssertEqual(list.first?["body"] as? String, "Edited")
        let metadata = try String(contentsOf: vault.appendingPathComponent(".memocard/pins.json"), encoding: .utf8)
        XCTAssertTrue(metadata.contains("path:Renamed.md"))
        XCTAssertFalse(metadata.contains("path:Original.md"))
    }

    func testNotePinsPersistWithoutChangingSourcesAndRejectStaleWrites() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased(), other = UUID().uuidString.lowercased()
        let path = try writeNote(id: id)
        _ = try writeNote(id: other)
        let original = try Data(contentsOf: path)
        let modified = try path.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
        let initial = try await call(core, "getNotePins")
        let pinned = try await call(core, "setNotePinned", ["id": id, "pinned": true, "baseHash": initial["contentHash"]!])
        let again = try await call(core, "setNotePinned", ["id": id, "pinned": true, "baseHash": pinned["contentHash"]!])
        XCTAssertEqual(again["contentHash"] as? String, pinned["contentHash"] as? String)
        XCTAssertEqual(try Data(contentsOf: path), original)
        XCTAssertEqual(try path.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate, modified)
        let reopened = try await store(create: false)
        let restored = try await call(reopened, "getNotePins")
        XCTAssertEqual(restored["pins"] as? [String: String], pinned["pins"] as? [String: String])
        let list = try await call(reopened, "queryNotes", ["pinned": true, "sort": "pinnedAt"])["notes"] as! [[String: Any]]
        XCTAssertEqual(list.compactMap { $0["id"] as? String }, [id])
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "setNotePinned", ["id": other, "pinned": true, "baseHash": initial["contentHash"]!]) }
        _ = try await call(core, "setNotePinned", ["id": id, "pinned": false, "baseHash": pinned["contentHash"]!])
        let empty = try await call(core, "queryNotes", ["pinned": true])["notes"] as! [[String: Any]]
        XCTAssertTrue(empty.isEmpty)
        let config = vault.appendingPathComponent(".memocard/pins.json")
        try Data("{broken".utf8).write(to: config)
        await expectCode("INVALID_PINS") { _ = try await self.call(core, "setNotePinned", ["id": id, "pinned": true, "baseHash": pinned["contentHash"]!]) }
        XCTAssertEqual(try String(contentsOf: config, encoding: .utf8), "{broken")
    }

    func testUpdatedAndPinnedQueriesUseStablePaginationAcrossTheWholeVault() async throws {
        let core = try await store()
        let old = "11111111-1111-4111-8111-111111111111", newer = "11111111-1111-4111-8111-111111111112"
        let path = try writeNote(id: old, date: "2026-09-01T09:00:00Z")
        let original = try String(contentsOf: path, encoding: .utf8)
        try Data(original.replacingOccurrences(of: "updatedAt: \"2026-09-01T09:00:00Z\"", with: "updatedAt: \"2026-10-14T09:00:00Z\"").utf8).write(to: path)
        _ = try writeNote(id: newer, date: "2026-10-13T09:00:00Z")
        let first = try await call(core, "queryNotes", ["sort": "updatedAt", "limit": 1])
        XCTAssertEqual((first["notes"] as! [[String: Any]])[0]["id"] as? String, old)
        let second = try await call(core, "queryNotes", ["sort": "updatedAt", "limit": 1, "cursor": first["nextCursor"]!])
        XCTAssertEqual((second["notes"] as! [[String: Any]])[0]["id"] as? String, newer)
        await expectCode("CURSOR_QUERY_MISMATCH") { _ = try await self.call(core, "queryNotes", ["limit": 1, "cursor": first["nextCursor"]!]) }
        let config = vault.appendingPathComponent(".memocard/pins.json")
        try encode([old: "2026-10-14T10:00:00Z", newer: "2026-10-14T10:00:00Z"]).write(to: config)
        let pinned = try await call(core, "queryNotes", ["sort": "pinnedAt", "pinned": true, "limit": 1])
        XCTAssertEqual((pinned["notes"] as! [[String: Any]])[0]["id"] as? String, old)
        let next = try await call(core, "queryNotes", ["sort": "pinnedAt", "pinned": true, "limit": 1, "cursor": pinned["nextCursor"]!])
        XCTAssertEqual((next["notes"] as! [[String: Any]])[0]["id"] as? String, newer)
        let state = try await call(core, "getNotePins")
        _ = try await call(core, "setNotePinned", ["id": old, "pinned": false, "baseHash": state["contentHash"]!])
        await expectCode("STALE_CURSOR") { _ = try await self.call(core, "queryNotes", ["sort": "pinnedAt", "pinned": true, "limit": 1, "cursor": pinned["nextCursor"]!]) }
    }

    func testBackgroundStatusReturnsBeforeReadingSourcesAndDraftsRemainAvailable() async throws {
        let core = try await store()
        for _ in 0..<200 { _ = try writeNote(id: UUID().uuidString.lowercased()) }
        let status = try await call(core, "getStatus", ["background": true])
        let progress = try XCTUnwrap(status["indexing"] as? [String: Any])
        XCTAssertEqual(progress["phase"] as? String, "reading")
        XCTAssertTrue(progress["total"] is NSNull)
        XCTAssertEqual((status["coverage"] as? [String: Any])?["complete"] as? Bool, false)
        let id = UUID().uuidString.lowercased()
        _ = try await call(core, "saveDraft", ["id": id, "body": "Typed during indexing", "tags": []])
        let drafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(drafts.first?["body"] as? String, "Typed during indexing")
        await core.close()
    }

    func waitForIndexPhase(_ core: VaultStore, _ phase: String) async throws -> [String: Any] {
        for _ in 0..<5000 {
            let status = try await call(core, "getStatus", ["background": true])
            if (status["indexing"] as? [String: Any])?["phase"] as? String == phase { return status }
            try await Task.sleep(nanoseconds: 1_000_000)
        }
        XCTFail("Index phase was not reached: \(phase)")
        return [:]
    }

    func testSourceEditsDuringBackgroundFiltersKeepHashesPropertiesAndReopenConsistent() async throws {
        for shared in [false, true] {
            vault = temporary.appendingPathComponent("background-\(shared)")
            try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true)
            let core = try await store(create: !shared)
            for n in 0..<80 {
                if shared { try Data("---\nsummary: original\n---\nBody \(n)".utf8).write(to: vault.appendingPathComponent("Note-\(n).md")) }
                else { _ = try writeNote(id: UUID().uuidString.lowercased(), extra: "summary: original\n") }
            }
            let original = try Dictionary(uniqueKeysWithValues: FileManager.default.enumerator(at: vault, includingPropertiesForKeys: nil)!.compactMap { item -> (String, Data)? in
                guard let url = item as? URL, url.pathExtension == "md" else { return nil }
                return (url.path, try Data(contentsOf: url))
            })
            let gate = IndexingTestGate()
            await core.setIndexingCheckpoint { phase in if phase == "indexing" { await gate.wait() } }
            _ = try await call(core, "getStatus", ["background": true])
            let status = try await waitForIndexPhase(core, "indexing")
            XCTAssertEqual((status["coverage"] as? [String: Any])?["complete"] as? Bool, true)
            let page = try await call(core, "queryNotes", ["limit": 100])
            var note = (page["notes"] as! [[String: Any]])[0]
            let id = note["id"] as! String, path = note["relativePath"] as! String
            for n in 0..<4 {
                note = try await call(core, "saveNote", ["id": id, "body": "Saved during indexing \(n) [link](https://example.com)", "tags": [], "baseHash": note["contentHash"]!])
                note = try await call(core, "updateNoteProperty", ["id": id, "name": "summary", "type": "text", "value": "Indexed value \(n)", "baseHash": note["contentHash"]!])
                XCTAssertEqual(sha256(try Data(contentsOf: vault.appendingPathComponent(path))), note["contentHash"] as? String)
                let progress = try await call(core, "getStatus", ["background": true])
                XCTAssertEqual((progress["indexing"] as? [String: Any])?["phase"] as? String, "indexing")
            }
            await gate.release()
            await core.setIndexingCheckpoint(nil)
            for _ in 0..<5000 {
                if try await call(core, "getStatus", ["background": true])["indexing"] == nil { break }
                try await Task.sleep(nanoseconds: 1_000_000)
            }
            let filtered = try await call(core, "queryNotes", ["quickFilter": "links"])
            XCTAssertEqual((filtered["notes"] as! [[String: Any]]).map { $0["id"] as! String }, [id])
            for (file, bytes) in original where URL(fileURLWithPath: file).resolvingSymlinksInPath().path != vault.appendingPathComponent(path).resolvingSymlinksInPath().path { XCTAssertEqual(try Data(contentsOf: URL(fileURLWithPath: file)), bytes) }
            await core.close()
            let reopened = try VaultStore(localDataURL: local)
            try await reopened.open(url: vault, create: false)
            let actual = try await call(reopened, "getNote", ["id": id])
            XCTAssertEqual(actual["body"] as? String, note["body"] as? String)
            XCTAssertEqual(actual["contentHash"] as? String, note["contentHash"] as? String)
            let properties = try await call(reopened, "getNoteProperties", ["id": id])["properties"] as! [[String: Any]]
            XCTAssertEqual(properties.first { $0["name"] as? String == "summary" }?["value"] as? String, "Indexed value 3")
            await reopened.close()
        }
    }

    func testValidationQueuesSourceCommitWhileDraftsContinueAndCorruptionStillBlocksIt() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased(), file = try writeNote(id: id)
        let before = try Data(contentsOf: file)
        let bad = vault.appendingPathComponent("notes/bad.md")
        try Data("invalid note".utf8).write(to: bad)
        let gate = IndexingTestGate()
        await core.setIndexingCheckpoint { phase in if phase == "reading" { await gate.wait() } }
        _ = try await call(core, "getStatus", ["background": true])
        let commit = Task { try await self.call(core, "saveNote", ["id": id, "body": "Do not commit", "tags": [], "baseHash": sha256(before)]) }
        for body in ["First draft", "Latest draft"] { _ = try await call(core, "saveDraft", ["id": id, "body": body, "tags": [], "baseHash": sha256(before)]) }
        let drafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(drafts.first?["body"] as? String, "Latest draft")
        await expectCode("INDEXING") {
            _ = try await self.call(core, "saveNote", ["id": id, "body": "Latest draft", "tags": [], "baseHash": sha256(before), "deferWhileIndexing": true])
        }
        XCTAssertEqual(try Data(contentsOf: file), before)
        await gate.release()
        await expectCode("SCAN_INCOMPLETE") { _ = try await commit.value }
        XCTAssertEqual(try Data(contentsOf: file), before)
        await core.close()
    }

    func testClosingDuringIndexingRejectsQueuedSaveInReplacementVault() async throws {
        let core = try await store(), id = UUID().uuidString.lowercased()
        let file = try writeNote(id: id), before = try Data(contentsOf: file)
        let gate = IndexingTestGate(), saveStarted = IndexingTestGate()
        await core.setIndexingCheckpoint { phase in
            if phase == "reading" { await gate.wait() }
            if phase == "waiting" { await saveStarted.release() }
        }
        _ = try await call(core, "getStatus", ["background": true])
        let commit = Task { try await self.call(core, "saveNote", ["id": id, "body": "Old request", "tags": [], "baseHash": sha256(before)]) }
        await saveStarted.wait()
        await core.close()
        let next = temporary.appendingPathComponent("replacement")
        try FileManager.default.createDirectory(at: next, withIntermediateDirectories: true)
        try await core.open(url: next, create: true)
        await gate.release()
        await expectCode("UNAUTHORIZED") { _ = try await commit.value }
        XCTAssertEqual(try Data(contentsOf: file), before)
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: next.path).filter { !$0.hasPrefix(".") }, [])
        await core.close()
    }

    func testClosingAfterPartialCompatibleIndexPreservesVisibleIdentityAndRecovery() async throws {
        let core = try await store(create: false)
        for n in 0..<100 { try Data("Body \(n)".utf8).write(to: vault.appendingPathComponent("Note-\(n).md")) }
        let gate = IndexingTestGate(skip: 1)
        await core.setIndexingCheckpoint { phase in if phase == "reading" { await gate.wait() } }
        _ = try await call(core, "getStatus", ["background": true])
        var note: [String: Any]?
        for _ in 0..<5000 {
            let page = try await call(core, "queryNotes")
            if let first = (page["notes"] as! [[String: Any]]).first { note = first; break }
            try await Task.sleep(nanoseconds: 1_000_000)
        }
        let visible = try XCTUnwrap(note), id = visible["id"] as! String
        _ = try await call(core, "saveDraft", ["id": id, "body": "Recovery before full scan", "tags": [], "baseHash": visible["contentHash"]!])
        await core.close()
        await gate.release()
        let reopened = try VaultStore(localDataURL: local)
        try await reopened.open(url: vault, create: false)
        let actual = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual(actual["relativePath"] as? String, visible["relativePath"] as? String)
        XCTAssertEqual(actual["contentHash"] as? String, visible["contentHash"] as? String)
        let drafts = try await call(reopened, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(drafts.first?["id"] as? String, id)
        XCTAssertEqual(drafts.first?["body"] as? String, "Recovery before full scan")
        await reopened.close()
    }

    func testBackgroundIndexStillProtectsExternalChangesAndDuplicateIdentities() async throws {
        let core = try await store(), id = UUID().uuidString.lowercased()
        let first = try writeNote(id: id), other = try writeNote(id: UUID().uuidString.lowercased())
        let before = try Data(contentsOf: first), otherBytes = try Data(contentsOf: other)
        let gate = IndexingTestGate()
        await core.setIndexingCheckpoint { phase in if phase == "indexing" { await gate.wait() } }
        _ = try await call(core, "getStatus", ["background": true])
        _ = try await waitForIndexPhase(core, "indexing")
        try before.write(to: other, options: .atomic)
        await expectCode("DUPLICATE_ID") { _ = try await self.save(core, id: id, body: "Must not overwrite", hash: sha256(before)) }
        XCTAssertEqual(try Data(contentsOf: first), before)
        try otherBytes.write(to: other, options: .atomic)
        let external = before + Data("\nExternal during indexing".utf8)
        try external.write(to: first, options: .atomic)
        await expectCode("HASH_CONFLICT") { _ = try await self.save(core, id: id, body: "Old content", hash: sha256(before)) }
        XCTAssertEqual(try Data(contentsOf: first), external)
        let actual = try await call(core, "getNote", ["id": id])
        XCTAssertEqual(actual["contentHash"] as? String, sha256(external))
        await core.close()
        await gate.release()
    }

    func testInterruptedCommitRecoversAfterSameVolumeVaultMove() async throws {
        let core = try await store(create: false), note = try await save(core, body: "Before")
        let identity = await core.identityURL, identityBytes = try Data(contentsOf: identity)
        let path = note["relativePath"] as! String, before = try Data(contentsOf: vault.appendingPathComponent(path))
        let input: [String: Any] = ["id": note["id"]!, "body": "Pending", "tags": [], "baseHash": note["contentHash"]!]
        _ = try await call(core, "saveDraft", input)
        let journal = identity.appendingPathExtension("rename.json")
        let scope = String(identity.deletingPathExtension().lastPathComponent.dropFirst("identities-".count))
        let after = Data("Interrupted".utf8)
        try JSONSerialization.data(withJSONObject: ["root": vault.path, "scope": scope,
            "identities": JSONSerialization.jsonObject(with: identityBytes),
            "changes": [["path": path, "before": before.base64EncodedString(), "after": after.base64EncodedString()]]]).write(to: journal)
        try after.write(to: vault.appendingPathComponent(path))
        await core.close()
        let moved = temporary.appendingPathComponent("moved-with-journal")
        try FileManager.default.moveItem(at: vault, to: moved)
        let reopened = try VaultStore(localDataURL: local)
        try await reopened.open(url: moved, create: false)
        XCTAssertEqual(try Data(contentsOf: moved.appendingPathComponent(path)), before)
        XCTAssertFalse(FileManager.default.fileExists(atPath: journal.path))
        let recovered = try await call(reopened, "getDrafts")
        XCTAssertEqual((recovered["drafts"] as! [[String: Any]]).first?["body"] as? String, "Pending")
        let saved = try await call(reopened, "saveNote", input)
        XCTAssertEqual(saved["id"] as? String, note["id"] as? String)
        XCTAssertEqual(saved["body"] as? String, "Pending")
    }

    func testScopedJournalRejectsAnotherInstanceAtTheSamePath() async throws {
        let core = try await store(create: false), note = try await save(core, body: "Before")
        let path = note["relativePath"] as! String, file = vault.appendingPathComponent(path)
        let before = try Data(contentsOf: file), after = Data("Interrupted".utf8)
        let journal = await core.identityURL.appendingPathExtension("rename.json")
        try JSONSerialization.data(withJSONObject: ["root": vault.path, "scope": String(repeating: "0", count: 64), "identities": [],
            "changes": [["path": path, "before": before.base64EncodedString(), "after": after.base64EncodedString()]]]).write(to: journal)
        try after.write(to: file)
        await expectCode("RENAME_RECOVERY_REQUIRED") { _ = try await self.call(core, "getNote", ["id": note["id"]!]) }
        XCTAssertEqual(try Data(contentsOf: file), after)
        XCTAssertTrue(FileManager.default.fileExists(atPath: journal.path))
        _ = try await call(core, "saveDraft", ["id": note["id"]!, "body": "Protected recovery", "tags": [], "baseHash": note["contentHash"]!])
        let drafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(drafts.first?["body"] as? String, "Protected recovery")
    }

    func testStableLocalIndexAvoidsEnumerationAcrossContinuousEdits() async throws {
        for shared in [false, true] {
            vault = temporary.appendingPathComponent("index-\(shared)")
            try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true)
            let core = try await store(create: !shared)
            if shared {
                for n in 0..<40 { try Data("---\nsummary: original\n---\nBody \(n)".utf8).write(to: vault.appendingPathComponent("Note-\(n).md")) }
            } else {
                for _ in 0..<40 { _ = try writeNote(id: UUID().uuidString.lowercased(), extra: "summary: original\n") }
            }
            let page = try await call(core, "queryNotes")
            var note = (page["notes"] as! [[String: Any]])[0]
            let scans = await core.scanCount
            for n in 0..<3 {
                _ = try await call(core, "getNote", ["id": note["id"]!])
                _ = try await call(core, "getNoteProperties", ["id": note["id"]!])
                note = try await call(core, "saveNote", ["id": note["id"]!, "body": "Revision \(n)", "tags": [], "baseHash": note["contentHash"]!])
                note = try await call(core, "updateNoteProperty", ["id": note["id"]!, "name": "summary", "type": "text", "value": "Value \(n)", "baseHash": note["contentHash"]!])
                await core.invalidateSnapshot() // Same invalidation delivered by native file presenters.
            }
            let after = await core.scanCount
            XCTAssertEqual(after, scans, "Stable topology must not be re-enumerated for single-note operations")
            let reopened = try VaultStore(localDataURL: local); try await reopened.open(url: vault, create: false)
            let saved = try await call(reopened, "getNote", ["id": note["id"]!])
            XCTAssertEqual(saved["body"] as? String, "Revision 2")
            XCTAssertEqual(saved["contentHash"] as? String, note["contentHash"] as? String)
            let properties = try await call(reopened, "getNoteProperties", ["id": note["id"]!])
            XCTAssertEqual((properties["properties"] as! [[String: Any]]).first { $0["name"] as? String == "summary" }?["value"] as? String, "Value 2")
        }
    }

    func testWarmIndexStillBlocksWritesAfterUnrelatedCorruptionOrDuplicate() async throws {
        let core = try await store()
        let first = UUID().uuidString.lowercased(), second = UUID().uuidString.lowercased()
        let a = try writeNote(id: first), b = try writeNote(id: second)
        let note = try await call(core, "getNote", ["id": first])
        let bytes = try Data(contentsOf: a), originalB = try Data(contentsOf: b)
        try Data("invalid".utf8).write(to: b)
        await expectCode("SCAN_INCOMPLETE") { _ = try await self.save(core, id: first, body: "Must not commit", hash: note["contentHash"] as? String) }
        XCTAssertEqual(try Data(contentsOf: a), bytes)
        try originalB.write(to: b)
        _ = try await call(core, "getStatus")
        try bytes.write(to: b)
        await expectCode("DUPLICATE_ID") { _ = try await self.save(core, id: first, body: "Must not commit", hash: note["contentHash"] as? String) }
        XCTAssertEqual(try Data(contentsOf: a), bytes)
    }

    func testWarmIndexReconcilesNestedAddRenameDeleteAndPreservesOtherSources() async throws {
        let core = try await store(create: false)
        let nested = vault.appendingPathComponent("Nested/Deep")
        try FileManager.default.createDirectory(at: nested, withIntermediateDirectories: true)
        let first = nested.appendingPathComponent("First.md"), untouched = vault.appendingPathComponent("Untouched.md")
        try Data("First #before".utf8).write(to: first)
        let preserved = Data("---\nunknown: keep\n---\nUntouched".utf8)
        try preserved.write(to: untouched)
        let initial = try await call(core, "queryNotes")
        let original = (initial["notes"] as! [[String: Any]]).first { $0["relativePath"] as? String == "Nested/Deep/First.md" }!
        let added = nested.appendingPathComponent("Added.md")
        try Data("Added #external".utf8).write(to: added)
        let listed = try await call(core, "queryNotes")
        XCTAssertEqual((listed["notes"] as? [Any])?.count, 3)
        let moved = nested.appendingPathComponent("Moved.md")
        try FileManager.default.moveItem(at: first, to: moved)
        let renamed = try await call(core, "getNote", ["id": original["id"]!])
        XCTAssertEqual(renamed["relativePath"] as? String, "Nested/Deep/Moved.md")
        try FileManager.default.removeItem(at: added)
        await core.invalidateSnapshot()
        let refreshed = try await call(core, "getStatus")
        XCTAssertEqual((refreshed["coverage"] as? [String: Any])?["indexed"] as? Int, 2)
        XCTAssertEqual(try Data(contentsOf: untouched), preserved)
        let tags = try await call(core, "listTags")
        XCTAssertFalse((tags["tags"] as! [[String: Any]]).contains { $0["name"] as? String == "external" })
    }

    func testCopiedVaultDraftsAreIsolatedAndSameVolumeMovePreservesRecovery() async throws {
        for shared in [false, true] {
            vault = temporary.appendingPathComponent("instance-\(shared)")
            try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true)
            let core = try await store(create: !shared)
            let source = try await save(core, body: "Source"), id = source["id"] as! String
            let input: [String: Any] = ["id": id, "body": "Original recovery", "tags": [], "baseHash": source["contentHash"]!, "draftKey": UUID().uuidString.lowercased() + ":" + id]
            _ = try await call(core, "saveDraft", input)
            let copy = temporary.appendingPathComponent("copy-\(shared)")
            try FileManager.default.copyItem(at: vault, to: copy)
            let copyBytes = try Data(contentsOf: copy.appendingPathComponent(source["relativePath"] as! String))
            let clone = try VaultStore(localDataURL: local)
            try await clone.open(url: copy, create: false)
            let checked1 = try await call(clone, "getDrafts")
            XCTAssertEqual((checked1["drafts"] as? [Any])?.count, 0)
            let cloneNote = (try await call(clone, "queryNotes")["notes"] as! [[String: Any]]).first!
            _ = try await call(clone, "saveDraft", ["id": cloneNote["id"]!, "body": "Copy recovery", "tags": [], "baseHash": cloneNote["contentHash"]!])
            let checked2 = try await call(core, "getDrafts")
            XCTAssertEqual((checked2["drafts"] as! [[String: Any]]).first?["body"] as? String, "Original recovery")
            let moved = temporary.appendingPathComponent("moved-\(shared)")
            await core.close()
            try FileManager.default.moveItem(at: vault, to: moved)
            let reopened = try VaultStore(localDataURL: local)
            try await reopened.open(url: moved, create: false)
            let checked3 = try await call(reopened, "getDrafts")
            XCTAssertEqual((checked3["drafts"] as! [[String: Any]]).first?["body"] as? String, "Original recovery")
            let same = try await call(reopened, "getNote", ["id": id])
            XCTAssertEqual(same["id"] as? String, id)
            _ = try await call(reopened, "saveNote", input)
            let checked4 = try await call(reopened, "getNote", ["id": id])
            XCTAssertEqual((checked4)["body"] as? String, "Original recovery")
            XCTAssertEqual(try Data(contentsOf: copy.appendingPathComponent(source["relativePath"] as! String)), copyBytes)
            let checked5 = try await call(clone, "getDrafts")
            XCTAssertEqual((checked5["drafts"] as! [[String: Any]]).first?["body"] as? String, "Copy recovery")
        }
    }

    func testCorruptDraftsReturnIndividualIssuesWithoutBlockingGoodVersions() async throws {
        let core = try await store(), source = try await save(core, body: "Source")
        let ids = [UUID().uuidString.lowercased(), UUID().uuidString.lowercased()]
        for (index,id) in ids.enumerated() { _ = try await call(core, "saveDraft", ["id": id, "body": "Good \(index)", "tags": [], "baseHash": NSNull()]) }
        let files = FileManager.default.enumerator(at: local.appendingPathComponent("drafts"), includingPropertiesForKeys: nil)!.allObjects as! [URL]
        let directory = files.first { $0.lastPathComponent == ids[0] + ".json" }!.deletingLastPathComponent()
        let corrupt = directory.appendingPathComponent("broken.json"), invalid = directory.appendingPathComponent("invalid.json")
        let bytes = Data("{truncated".utf8)
        try bytes.write(to: corrupt)
        try Data("{\"id\":\"invalid\",\"body\":\"Keep\",\"tags\":[],\"baseHash\":null,\"updatedAt\":\"invalid\"}".utf8).write(to: invalid)
        let result = try await call(core, "getDrafts")
        XCTAssertEqual(Set((result["drafts"] as! [[String: Any]]).map { $0["body"] as! String }), Set(["Good 0", "Good 1"]))
        let issues = result["issues"] as! [[String: Any]]
        XCTAssertEqual(issues.count, 2); XCTAssertTrue(issues.contains { ($0["path"] as? String)?.hasSuffix("broken.json") == true })
        XCTAssertEqual(try Data(contentsOf: corrupt), bytes)
        let checked6 = try await call(core, "getNote", ["id": source["id"]!])
        XCTAssertEqual((checked6)["body"] as? String, "Source")
        let reopened = try VaultStore(localDataURL: local); try await reopened.open(url: vault, create: false)
        let checked7 = try await call(reopened, "getDrafts")
        XCTAssertEqual((checked7["drafts"] as? [Any])?.count, 2)
    }

    func testIdentityWriteFailureRollsBackBodyAndPreservesRetryableRecovery() async throws {
        let core = try await store(create: false), note = try await save(core, body: "Before"), id = note["id"] as! String
        let source = vault.appendingPathComponent(note["relativePath"] as! String), before = try Data(contentsOf: source)
        let identity = try FileManager.default.contentsOfDirectory(at: local, includingPropertiesForKeys: nil).first { $0.lastPathComponent.hasPrefix("identities-") && $0.pathExtension == "json" }!
        let identityBytes = try Data(contentsOf: identity)
        let input: [String: Any] = ["id": id, "body": "After", "tags": [], "baseHash": note["contentHash"]!]
        _ = try await call(core, "saveDraft", input)
        try FileManager.default.removeItem(at: identity); try FileManager.default.createDirectory(at: identity, withIntermediateDirectories: false)
        await expectCode("IO_ERROR") { _ = try await self.call(core, "saveNote", input) }
        XCTAssertEqual(try Data(contentsOf: source), before)
        let checked8 = try await call(core, "getDrafts")
        XCTAssertEqual((checked8["drafts"] as! [[String: Any]]).first?["body"] as? String, "After")
        try FileManager.default.removeItem(at: identity); try identityBytes.write(to: identity)
        let committed = try await call(core, "saveNote", input)
        XCTAssertEqual(committed["id"] as? String, id); XCTAssertEqual(committed["body"] as? String, "After")
        let reopened = try VaultStore(localDataURL: local); try await reopened.open(url: vault, create: false)
        let checked9 = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual((checked9)["contentHash"] as? String, committed["contentHash"] as? String)
        let checked10 = try await call(reopened, "getDrafts")
        XCTAssertEqual((checked10["drafts"] as? [Any])?.count, 0)
    }

    func testIdentityWriteFailureRollsBackPropertyWithoutChangingBodyOrHash() async throws {
        let core = try await store(create: false), note = try await save(core, body: "Body"), id = note["id"] as! String
        let source = vault.appendingPathComponent(note["relativePath"] as! String), before = try Data(contentsOf: source)
        let identity = try FileManager.default.contentsOfDirectory(at: local, includingPropertiesForKeys: nil).first { $0.lastPathComponent.hasPrefix("identities-") && $0.pathExtension == "json" }!
        let identityBytes = try Data(contentsOf: identity)
        let change: [String: Any] = ["id": id, "baseHash": note["contentHash"]!, "name": "summary", "type": "text", "create": true, "value": "After"]
        _ = try await call(core, "saveDraft", ["id": id, "body": "Body", "tags": [], "baseHash": note["contentHash"]!, "pendingProperties": [change]])
        try FileManager.default.removeItem(at: identity); try FileManager.default.createDirectory(at: identity, withIntermediateDirectories: false)
        await expectCode("IO_ERROR") { _ = try await self.call(core, "updateNoteProperty", change) }
        XCTAssertEqual(try Data(contentsOf: source), before)
        let checked11 = try await call(core, "getDrafts")
        XCTAssertEqual(((checked11["drafts"] as! [[String: Any]]).first?["pendingProperties"] as? [Any])?.count, 1)
        try FileManager.default.removeItem(at: identity); try identityBytes.write(to: identity)
        let committed = try await call(core, "updateNoteProperty", change)
        XCTAssertEqual(committed["id"] as? String, id); XCTAssertEqual(committed["body"] as? String, "Body")
        let reopened = try VaultStore(localDataURL: local); try await reopened.open(url: vault, create: false)
        let checked12 = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual((checked12)["contentHash"] as? String, committed["contentHash"] as? String)
    }

    func testAbandonedInstanceRemainsExplicitlyRecoverableWithoutAdoptingActiveCopyDrafts() async throws {
        let core = try await store(), note = try await save(core, body: "Source"), id = note["id"] as! String
        let draft = try await call(core, "saveDraft", ["id": id, "body": "Moved recovery", "tags": [], "baseHash": note["contentHash"]!])
        let copy = temporary.appendingPathComponent("relocated-instance"); try FileManager.default.copyItem(at: vault, to: copy)
        let clone = try VaultStore(localDataURL: local); try await clone.open(url: copy, create: false)
        let active = try await call(clone, "getDrafts")
        XCTAssertEqual((active["drafts"] as? [Any])?.count, 0); XCTAssertEqual((active["unscopedDrafts"] as? [Any])?.count, 0)
        await core.close(); try FileManager.default.removeItem(at: vault)
        let available = try await call(clone, "getDrafts")
        XCTAssertEqual((available["drafts"] as? [Any])?.count, 0)
        let orphan = try XCTUnwrap((available["unscopedDrafts"] as? [[String: Any]])?.first)
        XCTAssertEqual(orphan["body"] as? String, "Moved recovery")
        let scope = try XCTUnwrap(orphan["recoveryScope"] as? String)
        let sourceFile = copy.appendingPathComponent(note["relativePath"] as! String), originalBytes = try Data(contentsOf: sourceFile)
        let input: [String: Any] = ["id": id, "body": "Recovered explicitly", "tags": [], "baseHash": note["contentHash"]!, "draftKey": UUID().uuidString.lowercased() + ":" + id, "recoveredFrom": ["draftKey": id, "revision": draft["revision"]!, "unscoped": true, "scope": scope]]
        _ = try await call(clone, "saveDraft", input)
        await expectCode("INVALID_DRAFT") { _ = try await self.call(clone, "saveNote", input.merging(["recoveredFrom": ["draftKey": id, "revision": "old", "unscoped": true, "scope": "../other"]]) { _,next in next }) }
        XCTAssertEqual(try Data(contentsOf: sourceFile), originalBytes)
        _ = try await call(clone, "saveNote", input)
        let after = try await call(clone, "getDrafts")
        XCTAssertEqual((after["unscopedDrafts"] as? [Any])?.count, 0)
        let committed = try await call(clone, "getNote", ["id": id])
        XCTAssertEqual(committed["body"] as? String, "Recovered explicitly")
    }

    func testLegacyUnscopedRecoveryRequiresSelectionAndOnlyRetiresAfterCommit() async throws {
        let core = try await store(), note = try await save(core, body: "Source"), id = note["id"] as! String
        let draft = try await call(core, "saveDraft", ["id": id, "body": "Old recovery", "tags": [], "baseHash": note["contentHash"]!])
        let metadata = try JSONDecoder().decode(VaultMetadata.self, from: Data(contentsOf: vault.appendingPathComponent(".memocard/vault.json")))
        let legacy = local.appendingPathComponent("drafts/\(metadata.vaultId)")
        try FileManager.default.createDirectory(at: legacy, withIntermediateDirectories: true)
        let original = legacy.appendingPathComponent("\(id).json")
        try FileManager.default.moveItem(at: await core.draftDirectory().appendingPathComponent("\(id).json"), to: original)
        let found = try await call(core, "getDrafts")
        XCTAssertEqual((found["drafts"] as? [Any])?.count, 0)
        XCTAssertEqual((found["unscopedDrafts"] as! [[String: Any]]).first?["unscoped"] as? Bool, true)
        let copy = temporary.appendingPathComponent("legacy-copy"); try FileManager.default.copyItem(at: vault, to: copy)
        let clone = try VaultStore(localDataURL: local); try await clone.open(url: copy, create: false)
        let verified1 = try await call(clone, "getDrafts")
        XCTAssertEqual((verified1["drafts"] as? [Any])?.count, 0)
        let fork: [String: Any] = ["id": id, "body": "Recovered explicitly", "tags": [], "baseHash": note["contentHash"]!, "draftKey": UUID().uuidString.lowercased() + ":" + id, "recoveredFrom": ["draftKey": id, "revision": draft["revision"]!, "unscoped": true]]
        _ = try await call(core, "saveDraft", fork)
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "saveNote", fork.merging(["baseHash": "stale"]) { _,next in next }) }
        XCTAssertTrue(FileManager.default.fileExists(atPath: original.path))
        _ = try await call(core, "saveNote", fork)
        XCTAssertFalse(FileManager.default.fileExists(atPath: original.path))
        let verified2 = try await call(core, "getNote", ["id": id])
        XCTAssertEqual((verified2)["body"] as? String, "Recovered explicitly")
        let verified3 = try await call(clone, "getNote", ["id": id])
        XCTAssertEqual((verified3)["body"] as? String, "Source")
    }

    func testPermanentDeletionChecksReviewedHashAndRemovesOnlyOneArchive() async throws {
        let core=try await store(), first=try await save(core,body:"Erase this"), second=try await save(core,body:"Keep archive"), live=try await save(core,body:"Keep live")
        let asset=vault.appendingPathComponent("assets/shared.png");try Data([1,2,3]).write(to:asset)
        for note in [first,second] { _ = try await call(core,"deleteNote",["id":note["id"]!,"baseHash":note["contentHash"]!]) }
        let items=try await call(core,"getTrash")["notes"] as! [[String:Any]], target=items.first{$0["id"] as? String == first["id"] as? String}!
        let archived=vault.appendingPathComponent(".memocard/trash/"+(target["trashKey"] as! String)), original=try Data(contentsOf:archived)
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core,"permanentlyDeleteNote",["trashKey":target["trashKey"]!,"baseHash":"stale"]) }
        XCTAssertEqual(try Data(contentsOf:archived),original)
        let deleted=try await call(core,"permanentlyDeleteNote",["trashKey":target["trashKey"]!,"baseHash":target["contentHash"]!])
        XCTAssertEqual(deleted["deleted"] as? Bool,true);XCTAssertFalse(FileManager.default.fileExists(atPath:archived.path))
        let remaining=try await call(core,"getTrash")["notes"] as! [[String:Any]]
        XCTAssertEqual(remaining.compactMap{$0["id"] as? String},[second["id"] as! String])
        let loaded=try await call(core,"getNote",["id":live["id"]!]);XCTAssertEqual(loaded["body"] as? String,"Keep live")
        XCTAssertEqual(try Data(contentsOf:asset),Data([1,2,3]))
        do { _ = try await call(core,"restoreNote",["trashKey":target["trashKey"]!,"baseHash":target["contentHash"]!]);XCTFail("Deleted source must not restore") } catch {}
        await expectCode("PATH_NOT_ALLOWED") { _ = try await self.call(core,"permanentlyDeleteNote",["trashKey":UUID().uuidString.lowercased()+"/../outside.md","baseHash":"stale"]) }
    }

    func testPermanentDeletionRejectsSymlinkWithoutTouchingTarget() async throws {
        let core=try await store(), note=try await save(core,body:"Keep this")
        let receipt=try await call(core,"deleteNote",["id":note["id"]!,"baseHash":note["contentHash"]!]), archive=vault.appendingPathComponent(receipt["trashPath"] as! String)
        let target=temporary.appendingPathComponent("outside.md");try Data("External".utf8).write(to:target)
        try FileManager.default.removeItem(at:archive);try FileManager.default.createSymbolicLink(at:archive,withDestinationURL:target)
        await expectCode("SYMLINK_NOT_ALLOWED") { _ = try await self.call(core,"permanentlyDeleteNote",["trashKey":String((receipt["trashPath"] as! String).dropFirst(".memocard/trash/".count)),"baseHash":note["contentHash"]!]) }
        XCTAssertEqual(try String(contentsOf:target,encoding:.utf8),"External")
    }

    func testTrashRestoresExactCompatibleSourceAndIdentityAfterReopening() async throws {
        let folder = vault.appendingPathComponent("Folder");try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        let path=folder.appendingPathComponent("Raw.md"), bytes=Data("\u{feff}---\r\ntags: [work]\r\n---\r\nBody ![image](../assets/keep.png)\r\n".utf8)
        try bytes.write(to:path)
        let core=try await store(create:false), note=(try await call(core,"queryNotes")["notes"] as! [[String:Any]])[0]
        let receipt = try await call(core,"deleteNote",["id":note["id"]!,"baseHash":note["contentHash"]!])
        XCTAssertEqual(receipt["contentHash"] as? String, note["contentHash"] as? String)
        XCTAssertEqual(receipt["trashPath"] as? String, ".memocard/trash/" + (receipt["trashKey"] as! String))
        try FileManager.default.removeItem(at:folder)
        await core.close()
        let reopened=try await store(create:false), items=try await call(reopened,"getTrash")["notes"] as! [[String:Any]]
        XCTAssertEqual(items.count,1);XCTAssertEqual(items[0]["id"] as? String,note["id"] as? String)
        let preview=try await call(reopened,"getTrashedNote",["trashKey":items[0]["trashKey"]!])["note"] as! [String:Any]
        XCTAssertEqual(preview["body"] as? String,note["body"] as? String)
        let restored=try await call(reopened,"restoreNote",["trashKey":items[0]["trashKey"]!,"baseHash":items[0]["contentHash"]!])
        XCTAssertEqual(restored["id"] as? String,note["id"] as? String);XCTAssertEqual(try Data(contentsOf:path),bytes)
        let remaining=try await call(reopened,"getTrash")["notes"] as! [[String:Any]]
        XCTAssertTrue(remaining.isEmpty)
        let loaded=try await call(reopened,"getNote",["id":note["id"]!])
        XCTAssertEqual(loaded["contentHash"] as? String,note["contentHash"] as? String)
    }

    func testTrashRestoreAvoidsFilenameCollisionAndRejectsStaleHash() async throws {
        let core=try await store(), note=try await save(core,body:"Original #work"), path=vault.appendingPathComponent(note["relativePath"] as! String)
        _ = try await call(core,"deleteNote",["id":note["id"]!,"baseHash":note["contentHash"]!])
        let item=(try await call(core,"getTrash")["notes"] as! [[String:Any]])[0]
        let other=try await save(core,body:"Do not overwrite"), before=try Data(contentsOf:path)
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core,"restoreNote",["trashKey":item["trashKey"]!,"baseHash":"stale"]) }
        let restored=try await call(core,"restoreNote",["trashKey":item["trashKey"]!,"baseHash":item["contentHash"]!])
        XCTAssertEqual(restored["relativePath"] as? String,"notes/新内容 (2).md")
        XCTAssertEqual(try Data(contentsOf:path),before)
        let notes=try await call(core,"queryNotes")["notes"] as! [[String:Any]]
        XCTAssertEqual(Set(notes.compactMap{$0["id"] as? String}),Set([note["id"] as! String,other["id"] as! String]))
        await expectCode("PATH_NOT_ALLOWED") { _ = try await self.call(core,"getTrashedNote",["trashKey":UUID().uuidString.lowercased()+"/../outside.md"]) }
    }

    func testMCPCompatibleNoteKeepsIDAfterDeleteReopenAndRestore() async throws {
        let core = try await store(create: false)
        _ = try await call(core, "createNote", ["id": UUID().uuidString.lowercased(), "title": "保留原笔记", "body": "untouched"])
        let id = UUID().uuidString.lowercased()
        let first = try await call(core, "createNote", ["id": id, "title": "临时测试 · MCP 删除与恢复", "body": "first"])
        let updated = try await call(core, "updateNote", ["id": id, "baseHash": first["contentHash"]!, "body": "latest"])
        let receipt = try await call(core, "deleteNote", ["id": id, "baseHash": updated["contentHash"]!])
        // A file provider can retain hidden metadata on an archived source.
        // Restoring must publish a visible active file without losing its note ID.
        var archiveURL = vault.appendingPathComponent(receipt["trashPath"] as! String)
        var attributes = URLResourceValues(); attributes.isHidden = true
        try archiveURL.setResourceValues(attributes)
        _ = try await call(core, "queryNotes")
        await core.close()
        let reopened = try await store(create: false)
        _ = try await call(reopened, "getStatus", ["background": true])
        let archived = try await call(reopened, "getTrashedNote", ["trashKey": receipt["trashKey"]!])
        let note = archived["note"] as! [String: Any]
        let restored = try await call(reopened, "restoreNote", ["trashKey": receipt["trashKey"]!, "baseHash": note["contentHash"]!])
        XCTAssertEqual(restored["id"] as? String, id)
        let loaded = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual(loaded["body"] as? String, "latest")
        XCTAssertEqual(loaded["contentHash"] as? String, restored["contentHash"] as? String)
    }

    func testRestoreRollsBackPublishedFileWhenArchiveRemovalFails() async throws {
        let core = try await store(create: false)
        let note = try await call(core, "createNote", ["id": UUID().uuidString.lowercased(), "body": "Keep exact archived bytes"])
        let receipt = try await call(core, "deleteNote", ["id": note["id"]!, "baseHash": note["contentHash"]!])
        let archive = vault.appendingPathComponent(receipt["trashPath"] as! String)
        let original = try Data(contentsOf: archive)
        let directory = archive.deletingLastPathComponent()
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: directory.path)
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: directory.path) }
        do {
            _ = try await call(core, "restoreNote", ["trashKey": receipt["trashKey"]!, "baseHash": note["contentHash"]!])
            XCTFail("A failed archive removal must not report restoration")
        } catch {}
        XCTAssertFalse(FileManager.default.fileExists(atPath: vault.appendingPathComponent(note["relativePath"] as! String).path))
        XCTAssertEqual(try Data(contentsOf: archive), original)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: directory.path)
        let restored = try await call(core, "restoreNote", ["trashKey": receipt["trashKey"]!, "baseHash": note["contentHash"]!])
        XCTAssertEqual(restored["id"] as? String, note["id"] as? String)
        XCTAssertEqual(restored["contentHash"] as? String, note["contentHash"] as? String)
    }

    func testTrashReadsOldArchiveWithoutMetadataAndRetainsUnreadableEntries() async throws {
        let core=try await store(), note=try await save(core)
        let deleted=try await call(core,"deleteNote",["id":note["id"]!,"baseHash":note["contentHash"]!]), archive=vault.appendingPathComponent(deleted["trashPath"] as! String)
        try FileManager.default.removeItem(at:archive.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("entry.json"))
        let corrupt=vault.appendingPathComponent(".memocard/trash/"+UUID().uuidString.lowercased()+"/Broken.md")
        try FileManager.default.createDirectory(at:corrupt.deletingLastPathComponent(),withIntermediateDirectories:true);try Data([0xff]).write(to:corrupt)
        let list=try await call(core,"getTrash"), items=list["notes"] as! [[String:Any]]
        XCTAssertEqual(items.count,1);XCTAssertEqual((list["issues"] as! [[String:Any]]).count,1)
        _ = try await call(core,"restoreNote",["trashKey":items[0]["trashKey"]!,"baseHash":items[0]["contentHash"]!])
        XCTAssertTrue(FileManager.default.fileExists(atPath:corrupt.path))
    }

    func testCompatibleRestoreHandlesImmediateReplacementAndBlockedJournal() async throws {
        let path=vault.appendingPathComponent("Raw.md");try Data("Original".utf8).write(to:path)
        let core=try await store(create:false), note=(try await call(core,"queryNotes")["notes"] as! [[String:Any]])[0]
        _ = try await call(core,"deleteNote",["id":note["id"]!,"baseHash":note["contentHash"]!])
        try Data("Replacement".utf8).write(to:path)
        let item=(try await call(core,"getTrash")["notes"] as! [[String:Any]])[0]
        let blocked=await core.identityURL.appendingPathExtension("rename.json")
        try FileManager.default.createDirectory(at:blocked,withIntermediateDirectories:true)
        do { _ = try await call(core,"restoreNote",["trashKey":item["trashKey"]!,"baseHash":item["contentHash"]!]);XCTFail("Blocked journal should fail") } catch {}
        try FileManager.default.removeItem(at:blocked)
        XCTAssertEqual(try String(contentsOf:path,encoding:.utf8),"Replacement")
        let restored=try await call(core,"restoreNote",["trashKey":item["trashKey"]!,"baseHash":item["contentHash"]!])
        XCTAssertEqual(restored["relativePath"] as? String,"Raw (2).md")
        XCTAssertEqual(restored["id"] as? String,note["id"] as? String)
        XCTAssertEqual(try String(contentsOf:path,encoding:.utf8),"Replacement")
    }

    func testDeleteNoteArchivesExactSourceAndPreservesAttachmentsAndOtherNotes() async throws {
        let core = try await store(), note = try await save(core, body: "Keep bytes #work ![image](../assets/keep.png)")
        let other = try await save(core, body: "Other source"), id = note["id"] as! String
        let path = vault.appendingPathComponent(note["relativePath"] as! String), original = try Data(contentsOf: path)
        let asset = vault.appendingPathComponent("assets/keep.png"); try Data([1,2,3]).write(to:asset)
        _ = try await call(core, "setNotePinned", ["id":id,"pinned":true,"baseHash":try await call(core,"getNotePins")["contentHash"]!])
        let receipt = try await call(core, "deleteNote", ["id":id,"baseHash":note["contentHash"]!])
        XCTAssertFalse(FileManager.default.fileExists(atPath:path.path))
        XCTAssertEqual(try Data(contentsOf:vault.appendingPathComponent(receipt["trashPath"] as! String)),original)
        XCTAssertEqual(try Data(contentsOf:asset),Data([1,2,3]))
        let notes = try await call(core,"queryNotes")["notes"] as! [[String:Any]]
        XCTAssertEqual(notes.compactMap{$0["id"] as? String},[other["id"] as! String])
        let resolvedPins = try await call(core,"getNotePins")["pins"] as! [String:String]
        let resolvedTags = try await call(core,"listTags")["tags"] as! [[String:Any]]
        XCTAssertTrue(resolvedPins.isEmpty)
        XCTAssertTrue(resolvedTags.isEmpty)
        await expectCode("NOTE_NOT_FOUND") { _ = try await self.call(core,"getNote",["id":id]) }
        await expectCode("NOTE_NOT_FOUND") { _ = try await self.save(core,id:id,body:"Stale save",hash:note["contentHash"] as? String) }
    }

    func testDeleteCompatibleNoteRejectsExternalEditsAndPreservesOriginalFormatting() async throws {
        let folder = vault.appendingPathComponent("Folder");try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        let path = folder.appendingPathComponent("Raw.md"), original = Data("\u{feff}---\r\nid: user-owned\r\ndeletedAt: user-owned\r\n---\r\nBody\r\n".utf8)
        try original.write(to:path)
        let core = try await store(create:false), note = (try await call(core,"queryNotes")["notes"] as! [[String:Any]])[0], id = note["id"] as! String
        var changed=original;changed.append(Data("External\r\n".utf8));try changed.write(to:path)
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core,"deleteNote",["id":id,"baseHash":note["contentHash"]!]) }
        XCTAssertEqual(try Data(contentsOf:path),changed)
        let receipt = try await call(core,"deleteNote",["id":id,"baseHash":sha256(changed)])
        XCTAssertEqual(try Data(contentsOf:vault.appendingPathComponent(receipt["trashPath"] as! String)),changed)
        XCTAssertEqual(receipt["relativePath"] as? String,"Folder/Raw.md")
    }

    func testDeleteNoteRejectsSymlinkedRecoveryDirectoryWithoutMovingSource() async throws {
        let core = try await store(), note = try await save(core), path=vault.appendingPathComponent(".memocard/trash")
        try FileManager.default.createSymbolicLink(at:path,withDestinationURL:temporary)
        await expectCode("SYMLINK_NOT_ALLOWED") { _ = try await self.call(core,"deleteNote",["id":note["id"]!,"baseHash":note["contentHash"]!]) }
        XCTAssertTrue(FileManager.default.fileExists(atPath:vault.appendingPathComponent(note["relativePath"] as! String).path))
    }

    func testDeleteDraftIsRevisionCheckedAndPreservesSiblingDraftAndSource() async throws {
        let core = try await store(), note = try await save(core, body: "Saved source"), id = note["id"] as! String
        let key = "\(UUID().uuidString.lowercased()):\(id)", sibling = "\(UUID().uuidString.lowercased()):\(id)"
        let original = try await call(core, "saveDraft", ["id":id, "draftKey":key, "body":"First edit", "tags":[], "baseHash":note["contentHash"]!])
        _ = try await call(core, "saveDraft", ["id":id, "draftKey":sibling, "body":"Other edit", "tags":[], "baseHash":note["contentHash"]!])
        let changed = try await call(core, "saveDraft", ["id":id, "draftKey":key, "body":"Newer edit", "tags":[], "baseHash":note["contentHash"]!])
        await expectCode("DRAFT_CHANGED") { _ = try await self.call(core, "deleteDraft", ["id":id, "draftKey":key, "revision":original["revision"]!]) }
        let result = try await call(core, "deleteDraft", ["id":id, "draftKey":key, "revision":changed["revision"]!])
        XCTAssertEqual(result["deleted"] as? Bool, true)
        let remaining = try await call(core, "getDrafts")["drafts"] as! [[String:Any]]
        XCTAssertEqual(remaining.compactMap { $0["draftKey"] as? String }, [sibling])
        let saved = try await call(core, "getNote", ["id":id])
        XCTAssertEqual(saved["body"] as? String, "Saved source")
        await expectCode("DRAFT_CHANGED") { _ = try await self.call(core, "deleteDraft", ["id":id, "draftKey":key, "revision":changed["revision"]!]) }
        await expectCode("INVALID_DRAFT") { _ = try await self.call(core, "deleteDraft", ["id":id, "draftKey":"../other", "revision":"unknown"]) }
    }

    func testDeleteLegacyDraftUsesExactRecoveryScopeAndDerivedRevision() async throws {
        let core = try await store(), id = UUID().uuidString.lowercased()
        _ = try await call(core, "saveDraft", ["id":id, "body":"Legacy edit", "tags":[]])
        let metadata = try JSONDecoder().decode(VaultMetadata.self, from: Data(contentsOf: vault.appendingPathComponent(".memocard/vault.json")))
        let legacy = local.appendingPathComponent("drafts/\(metadata.vaultId)")
        try FileManager.default.createDirectory(at: legacy, withIntermediateDirectories: true)
        let current = try await core.draftDirectory().appendingPathComponent("\(id).json")
        let original = legacy.appendingPathComponent("\(id).json")
        var record = try JSONSerialization.jsonObject(with: Data(contentsOf: current)) as! [String:Any]
        record.removeValue(forKey:"revision")
        try JSONSerialization.data(withJSONObject:record).write(to:original)
        let found = try await call(core, "getDrafts")["unscopedDrafts"] as! [[String:Any]]
        let draft = found.first!
        _ = try await call(core, "deleteDraft", ["id":id, "draftKey":id, "revision":draft["revision"]!, "unscoped":true])
        XCTAssertFalse(FileManager.default.fileExists(atPath:original.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath:current.path))
    }

    func testHistoricalDraftReminderReviewPreservesOriginalAndIsRevisionAndVaultScoped() async throws {
        let core = try await store(), note = try await save(core, body: "Saved source"), id = note["id"] as! String
        _ = try await call(core, "saveDraft", ["id": id, "body": "Historical edit", "tags": [], "baseHash": note["contentHash"]!])
        let metadata = try JSONDecoder().decode(VaultMetadata.self, from: Data(contentsOf: vault.appendingPathComponent(".memocard/vault.json")))
        let legacy = local.appendingPathComponent("drafts/\(metadata.vaultId)")
        try FileManager.default.createDirectory(at: legacy, withIntermediateDirectories: true)
        let original = legacy.appendingPathComponent("\(id).json")
        try FileManager.default.moveItem(at: await core.draftDirectory().appendingPathComponent("\(id).json"), to: original)
        let bytes = try Data(contentsOf: original)
        let found = try await call(core, "getDrafts")
        let draft = (found["unscopedDrafts"] as! [[String: Any]])[0]
        let input: [String: Any] = ["id": id, "draftKey": draft["draftKey"]!, "revision": draft["revision"]!, "unscoped": true]
        _ = try await call(core, "dismissDraftReminder", input)
        XCTAssertEqual(try Data(contentsOf: original), bytes)
        await core.close()
        let reopened = try await store()
        let reviewed = try await call(reopened, "getDrafts")
        XCTAssertEqual((reviewed["unscopedDrafts"] as! [[String: Any]])[0]["reminderDismissed"] as? Bool, true)
        let copy = temporary.appendingPathComponent("review-copy")
        try FileManager.default.copyItem(at: vault, to: copy)
        let clone = try VaultStore(localDataURL: local); try await clone.open(url: copy, create: false)
        let other = try await call(clone, "getDrafts")
        XCTAssertNotEqual((other["unscopedDrafts"] as! [[String: Any]])[0]["reminderDismissed"] as? Bool, true)
        var changed = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
        changed["body"] = "Changed historical edit"; changed["revision"] = UUID().uuidString.lowercased()
        let changedBytes = try JSONSerialization.data(withJSONObject: changed)
        try changedBytes.write(to: original, options: .atomic)
        await expectCode("DRAFT_CHANGED") { _ = try await self.call(reopened, "dismissDraftReminder", input) }
        let updated = try await call(reopened, "getDrafts")
        XCTAssertNotEqual((updated["unscopedDrafts"] as! [[String: Any]])[0]["reminderDismissed"] as? Bool, true)
        XCTAssertEqual(try Data(contentsOf: original), changedBytes)
        let saved = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual(saved["body"] as? String, "Saved source")
    }

    func testDraftReminderWriteFailureAndCorruptReviewKeepDraftVisibleAndUnchanged() async throws {
        let core = try await store(), id = UUID().uuidString.lowercased()
        let draft = try await call(core, "saveDraft", ["id": id, "body": "Recoverable", "tags": []])
        let file = try await core.draftDirectory().appendingPathComponent("\(id).json")
        let bytes = try Data(contentsOf: file), directory = local.appendingPathComponent("draft-reminders")
        try Data("blocked".utf8).write(to: directory)
        let input: [String: Any] = ["id": id, "draftKey": id, "revision": draft["revision"]!]
        await expectCode("IO_ERROR") { _ = try await self.call(core, "dismissDraftReminder", input) }
        let failed = try await call(core, "getDrafts")
        XCTAssertNotEqual((failed["drafts"] as! [[String: Any]])[0]["reminderDismissed"] as? Bool, true)
        try FileManager.default.removeItem(at: directory)
        _ = try await call(core, "dismissDraftReminder", input)
        let review = try XCTUnwrap(FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).first)
        try Data("corrupt review".utf8).write(to: review)
        let corrupt = try await call(core, "getDrafts")
        XCTAssertNotEqual((corrupt["drafts"] as! [[String: Any]])[0]["reminderDismissed"] as? Bool, true)
        XCTAssertEqual(try Data(contentsOf: file), bytes)
    }

    func testLegacyIdentityAndJournalMigrationPreserveIDsWithoutReplayingRollback() async throws {
        let core = try await store(create: false), note = try await save(core, body: "Before"), id = note["id"] as! String
        let identity = await core.identityURL, bytes = try Data(contentsOf: identity)
        let metadata = try JSONDecoder().decode(VaultMetadata.self, from: Data(contentsOf: vault.appendingPathComponent(".memocard/vault.json")))
        let old = local.appendingPathComponent("identities-\(sha256(Data((vault.path + ":" + metadata.vaultId).utf8))).json")
        let source = vault.appendingPathComponent(note["relativePath"] as! String), before = try Data(contentsOf: source), after = Data("Interrupted".utf8)
        await core.close(); try FileManager.default.moveItem(at: identity, to: old)
        let journal = old.appendingPathExtension("rename.json")
        try JSONSerialization.data(withJSONObject: ["root": vault.path, "identities": JSONSerialization.jsonObject(with: bytes), "changes": [["path": note["relativePath"]!, "before": before.base64EncodedString(), "after": after.base64EncodedString()]]]).write(to: journal)
        try after.write(to: source)
        let reopened = try VaultStore(localDataURL: local); try await reopened.open(url: vault, create: false)
        XCTAssertEqual(try Data(contentsOf: source), before); XCTAssertEqual(try Data(contentsOf: old), bytes)
        XCTAssertFalse(FileManager.default.fileExists(atPath: journal.path))
        let verified4 = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual((verified4)["contentHash"] as? String, note["contentHash"] as? String)
        let committed = try await save(reopened, id: id, body: "Later edit", hash: note["contentHash"] as? String)
        let again = try VaultStore(localDataURL: local); try await again.open(url: vault, create: false)
        let verified5 = try await call(again, "getNote", ["id": id])
        XCTAssertEqual((verified5)["contentHash"] as? String, committed["contentHash"] as? String)
    }

    func testInterruptedSourceAndIdentityCommitRestoresBeforeVersionAtEveryStage() async throws {
        for stage in 0...2 {
            vault = temporary.appendingPathComponent("interrupt-\(stage)"); try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true)
            let core = try await store(create: false), note = try await save(core, body: "Before"), id = note["id"] as! String
            let identity = await core.identityURL, bytes = try Data(contentsOf: identity)
            let source = vault.appendingPathComponent(note["relativePath"] as! String), before = try Data(contentsOf: source), after = Data("Interrupted".utf8)
            _ = try await call(core, "saveDraft", ["id": id, "body": "Pending newest", "tags": [], "baseHash": note["contentHash"]!])
            let journal = identity.appendingPathExtension("rename.json")
            try JSONSerialization.data(withJSONObject: ["root": vault.path, "identities": JSONSerialization.jsonObject(with: bytes), "changes": [["path": note["relativePath"]!, "before": before.base64EncodedString(), "after": after.base64EncodedString()]]]).write(to: journal)
            if stage > 0 { try after.write(to: source) }
            if stage > 1 { try encode([FileIdentity(id: id, path: note["relativePath"] as! String, hash: sha256(after), createdAt: note["createdAt"] as! String)]).write(to: identity) }
            let reopened = try VaultStore(localDataURL: local); try await reopened.open(url: vault, create: false)
            XCTAssertEqual(try Data(contentsOf: source), before); XCTAssertEqual(try Data(contentsOf: identity), bytes)
            XCTAssertFalse(FileManager.default.fileExists(atPath: journal.path))
            let verified6 = try await call(reopened, "getNote", ["id": id])
            XCTAssertEqual((verified6)["contentHash"] as? String, note["contentHash"] as? String)
            let verified7 = try await call(reopened, "getDrafts")
            XCTAssertEqual((verified7["drafts"] as! [[String: Any]]).first?["body"] as? String, "Pending newest")
            let saved = try await save(reopened, id: id, body: "Pending newest", hash: note["contentHash"] as? String)
            XCTAssertEqual(saved["id"] as? String, id)
        }
    }

    func testNewNoteCommitFailureLeavesNoSourceAndRetainsDraft() async throws {
        for stage in ["journal", "identity"] {
            vault = temporary.appendingPathComponent("new-failure-\(stage)"); try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true)
            let core = try await store(create: false), id = UUID().uuidString.lowercased()
            let identity = await core.identityURL, blocked = stage == "journal" ? identity.appendingPathExtension("rename.json") : identity
            try FileManager.default.createDirectory(at: blocked, withIntermediateDirectories: false)
            let input: [String: Any] = ["id": id, "body": "Newest", "tags": [], "baseHash": NSNull()]
            _ = try await call(core, "saveDraft", input)
            await expectCode("IO_ERROR") { _ = try await self.call(core, "saveNote", input) }
            XCTAssertFalse(try FileManager.default.contentsOfDirectory(atPath: vault.path).contains { $0.hasSuffix(".md") })
            let verified8 = try await call(core, "getDrafts")
            XCTAssertEqual((verified8["drafts"] as! [[String: Any]]).first?["body"] as? String, "Newest")
            try FileManager.default.removeItem(at: blocked)
            let verified9 = try await call(core, "saveNote", input)
            XCTAssertEqual((verified9)["id"] as? String, id)
        }
    }

    func testLostReplyDoesNotPermitOldRevisionToWriteTwice() async throws {
        let core = try await store(create: false), note = try await save(core, body: "Before"), id = note["id"] as! String
        let input: [String: Any] = ["id": id, "body": "After", "tags": [], "baseHash": note["contentHash"]!]
        _ = try await call(core, "saveDraft", input)
        _ = try await call(core, "saveNote", input) // The caller loses this successful reply.
        let source = vault.appendingPathComponent(note["relativePath"] as! String), committed = try Data(contentsOf: source)
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "saveNote", input) }
        XCTAssertEqual(try Data(contentsOf: source), committed)
        let reopened = try VaultStore(localDataURL: local); try await reopened.open(url: vault, create: false)
        let verified10 = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual((verified10)["body"] as? String, "After")
        let verified11 = try await call(reopened, "getDrafts")
        XCTAssertEqual((verified11["drafts"] as? [Any])?.count, 0)
    }

    func testClientDraftsSurviveReopenAndCommitOnlyRetiresItsOwnVersion() async throws {
        let core = try await store()
        let note = try await save(core, body: "Source"), id = note["id"] as! String
        let keyA = UUID().uuidString.lowercased() + ":" + id, keyB = UUID().uuidString.lowercased() + ":" + id
        let a: [String: Any] = ["id": id, "body": "Window A", "tags": [], "baseHash": note["contentHash"]!, "draftKey": keyA]
        let b: [String: Any] = ["id": id, "body": "Window B", "tags": [], "baseHash": note["contentHash"]!, "draftKey": keyB, "pendingProperties": [["id": id, "baseHash": note["contentHash"]!, "name": "summary", "type": "text", "value": "B pending"]]]
        _ = try await call(core, "saveDraft", a); _ = try await call(core, "saveDraft", b)
        let reopened = try await store(create: false)
        var drafts = try await call(reopened, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(Set(drafts.compactMap { $0["draftKey"] as? String }), Set([keyA, keyB]))
        let committed = try await call(reopened, "saveNote", a)
        XCTAssertEqual(committed["body"] as? String, "Window A")
        drafts = try await call(reopened, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(drafts.count, 1); XCTAssertEqual(drafts.first?["body"] as? String, "Window B")
        XCTAssertEqual((drafts.first?["pendingProperties"] as? [[String: Any]])?.first?["value"] as? String, "B pending")
        await expectCode("HASH_CONFLICT") { _ = try await self.call(reopened, "saveNote", b) }
        let unchanged = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual(unchanged["body"] as? String, "Window A")
        await expectCode("INVALID_DRAFT") { _ = try await self.call(core, "saveDraft", a.merging(["draftKey": "../escape"]) { _, next in next }) }
    }

    func testRecoveredClientDraftForkKeepsOriginalUntilSuccessfulCommit() async throws {
        let core = try await store()
        let note = try await save(core, body: "Source"), id = note["id"] as! String
        _ = try await call(core, "saveDraft", ["id": id, "body": "Legacy intent", "tags": [], "baseHash": note["contentHash"]!])
        let oldFile = try await core.draftDirectory().appendingPathComponent("\(id).json")
        var oldBytes = try JSONSerialization.jsonObject(with: Data(contentsOf: oldFile)) as! [String: Any]
        oldBytes.removeValue(forKey: "draftKey"); oldBytes.removeValue(forKey: "revision")
        try JSONSerialization.data(withJSONObject: oldBytes).write(to: oldFile)
        let legacyDrafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        let legacy = try XCTUnwrap(legacyDrafts.first)
        let key = UUID().uuidString.lowercased() + ":" + id
        var fork: [String: Any] = ["id": id, "body": "Continued intent", "tags": [], "baseHash": note["contentHash"]!, "draftKey": key, "recoveredFrom": ["draftKey": id, "revision": legacy["revision"]!]]
        _ = try await call(core, "saveDraft", fork)
        var drafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(drafts.count, 2)
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "saveNote", fork.merging(["baseHash": "stale"]) { _, next in next }) }
        drafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(drafts.count, 2)
        // A second recovery of the same record must retain its own independent intent.
        fork["draftKey"] = UUID().uuidString.lowercased() + ":" + id; fork["body"] = "Other recovery"
        _ = try await call(core, "saveDraft", fork)
        let firstFork = try XCTUnwrap(drafts.first { $0["draftKey"] as? String == key })
        _ = try await call(core, "saveNote", firstFork.merging(["recoveredFrom": ["draftKey": id, "revision": legacy["revision"]!]]) { _, next in next })
        drafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(drafts.count, 1); XCTAssertEqual(drafts.first?["body"] as? String, "Other recovery")
    }

    func testBlockedSourceTransactionStillAllowsLocalRecoveryReadAndWrite() async throws {
        let core = try await store()
        let note = try await save(core, body: "Before"), id = note["id"] as! String
        let path = note["relativePath"] as! String, file = vault.appendingPathComponent(path)
        let before = try Data(contentsOf: file), external = Data("External third version".utf8)
        let journal = await core.identityURL.appendingPathExtension("rename.json")
        let encoded = try JSONSerialization.data(withJSONObject: ["root": vault.path, "identities": [], "changes": [["path": path, "before": before.base64EncodedString(), "after": Data("Transaction after".utf8).base64EncodedString()]]])
        try encoded.write(to: journal); try external.write(to: file)
        await expectCode("RENAME_RECOVERY_REQUIRED") { _ = try await self.call(core, "queryNotes") }
        let input: [String: Any] = ["id": id, "body": "Newest protected input", "tags": [], "baseHash": note["contentHash"]!, "draftKey": UUID().uuidString.lowercased() + ":" + id, "pendingProperties": [["id": id, "baseHash": note["contentHash"]!, "name": "summary", "type": "text", "value": "Protected property"]]]
        _ = try await call(core, "saveDraft", input)
        let drafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(drafts.first?["body"] as? String, "Newest protected input")
        XCTAssertEqual((drafts.first?["pendingProperties"] as? [[String: Any]])?.first?["value"] as? String, "Protected property")
        await expectCode("RENAME_RECOVERY_REQUIRED") { _ = try await self.call(core, "saveNote", input) }
        XCTAssertEqual(try Data(contentsOf: file), external); XCTAssertEqual(try Data(contentsOf: journal), encoded)
        let reopened = try VaultStore(localDataURL: local)
        await expectCode("RENAME_RECOVERY_REQUIRED") { try await reopened.open(url: self.vault, create: false) }
        let restored = try await call(reopened, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(restored.first?["body"] as? String, "Newest protected input")
        _ = try await call(reopened, "saveDraft", input.merging(["body": "After restart"]) { _, next in next })
        XCTAssertEqual(try Data(contentsOf: file), external); XCTAssertEqual(try Data(contentsOf: journal), encoded)
    }

    func testRecoveryCleanupDoesNotRemoveANewerVersionOfTheOriginal() async throws {
        let core = try await store()
        let note = try await save(core, body: "Source"), id = note["id"] as! String
        let old = try await call(core, "saveDraft", ["id": id, "body": "Old", "tags": [], "baseHash": note["contentHash"]!])
        let fork: [String: Any] = ["id": id, "body": "Fork", "tags": [], "baseHash": note["contentHash"]!, "draftKey": UUID().uuidString.lowercased() + ":" + id, "recoveredFrom": ["draftKey": id, "revision": old["revision"]!]]
        _ = try await call(core, "saveDraft", fork)
        _ = try await call(core, "saveDraft", ["id": id, "body": "Newer independent input", "tags": [], "baseHash": note["contentHash"]!])
        _ = try await call(core, "saveNote", fork)
        let drafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(drafts.count, 1); XCTAssertEqual(drafts.first?["body"] as? String, "Newer independent input")
    }

    func testRecoveryWithPendingPropertiesRetainsOriginalUntilIntentIsCommitted() async throws {
        let core = try await store()
        let note = try await save(core, body: "Source"), id = note["id"] as! String
        let old = try await call(core, "saveDraft", ["id": id, "body": "Original intent", "tags": [], "baseHash": note["contentHash"]!])
        var fork: [String: Any] = ["id": id, "body": "Fork", "tags": [], "baseHash": note["contentHash"]!, "draftKey": UUID().uuidString.lowercased() + ":" + id, "recoveredFrom": ["draftKey": id, "revision": old["revision"]!], "pendingProperties": [["id": id, "baseHash": note["contentHash"]!, "name": "summary", "type": "text", "value": "Pending"]]]
        _ = try await call(core, "saveDraft", fork)
        let bodyCommit = try await call(core, "saveNote", fork)
        var drafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertEqual(drafts.count, 2)
        _ = try await call(core, "updateNoteProperty", ["id": id, "baseHash": bodyCommit["contentHash"]!, "name": "summary", "type": "text", "value": "Pending", "create": true])
        fork["baseHash"] = NSNull(); fork["body"] = ""; fork["pendingProperties"] = []
        _ = try await call(core, "saveDraft", fork)
        drafts = try await call(core, "getDrafts")["drafts"] as! [[String: Any]]
        XCTAssertFalse(drafts.contains { $0["body"] as? String == "Original intent" })
        let fields = try await call(core, "getNoteProperties", ["id": id])["properties"] as! [[String: Any]]
        XCTAssertEqual(fields.first?["value"] as? String, "Pending")
    }

    func testLossyDefinitionSwitchRejectsWholeBatchWithoutChangingAnyBytes() async throws {
        for shared in [false, true] {
          for (type, first, second) in [("date", "field: 2026-10-12\n", "field: important-beta\n"), ("checkbox", "field: true\n", "field: important-beta\n"), ("select", "field: [One]\n", "field: [One, Two]\n")] {
            vault = temporary.appendingPathComponent("lossless-\(shared)-\(type)")
            if shared { try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true) }
            let core = try await store(create: !shared)
            let aid = UUID().uuidString.lowercased(), bid = UUID().uuidString.lowercased()
            let a: URL, b: URL
            if shared {
                a = vault.appendingPathComponent("A.md"); b = vault.appendingPathComponent("B.md")
                try Data(("---\n" + first + "---\nA").utf8).write(to: a)
                try Data(("---\n" + second + "---\nB").utf8).write(to: b)
            } else {
                a = try writeNote(id: aid, filename: "A", body: "A", extra: first)
                b = try writeNote(id: bid, filename: "B", body: "B", extra: second)
            }
            let originals = try [Data(contentsOf: a), Data(contentsOf: b)]
            let page = try await call(core, "queryNotes")["notes"] as! [[String: Any]]
            let note = page.first { ($0["relativePath"] as! String).hasSuffix("A.md") }!
            await expectCode("LOSSY_PROPERTY_CONVERSION") { _ = try await self.call(core, "updateNoteProperty", ["id": note["id"]!, "baseHash": note["contentHash"]!, "name": "field", "type": type, "definition": true]) }
            XCTAssertEqual(try [Data(contentsOf: a), Data(contentsOf: b)], originals)
            XCTAssertFalse(FileManager.default.fileExists(atPath: vault.appendingPathComponent(propertyDefinitionPath).path))
          }
        }
    }

    func testPropertyWritesReturnFreshPropertiesWithoutAnotherScan() async throws {
        for shared in [false, true] {
            if shared {
                vault = temporary.appendingPathComponent("shared-write-result")
                try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true)
            }
            let core = try await store(create: !shared)
            let id = UUID().uuidString.lowercased()
            if shared { try Data("---\naliases: [One]\nsummary: before\n---\nBody #keep".utf8).write(to: vault.appendingPathComponent("A.md")) }
            else { _ = try writeNote(id: id, body: "Body #keep", extra: "aliases: [One]\nsummary: before\n") }
            var note = (try await call(core, "queryNotes")["notes"] as! [[String: Any]]).first!
            let noteID = note["id"] as! String
            for change: [String: Any] in [
                ["name": "summary", "type": "text", "value": "after"],
                ["name": "aliases", "type": "multiSelect", "value": ["Two"], "options": [["name": "Two", "color": "red"]]],
                ["name": "aliases", "type": "multiSelect", "value": ["One", "Two"], "options": [["name": "One", "color": "blue"], ["name": "Two", "color": "red"]], "definition": true],
                ["name": "aliases", "type": "text", "definition": true],
                ["name": "summary", "remove": true]
            ] {
                let before = await core.scanCount
                note = try await call(core, "updateNoteProperty", change.merging(["id": noteID, "baseHash": note["contentHash"]!]) { _, value in value })
                let scans = await core.scanCount
                XCTAssertLessThanOrEqual(scans - before, 1)
                let returned = try XCTUnwrap(note["propertyData"] as? [String: Any])
                XCTAssertEqual(returned["contentHash"] as? String, note["contentHash"] as? String)
                let loaded = try await call(core, "getNoteProperties", ["id": noteID])
                XCTAssertEqual(returned as NSDictionary, loaded as NSDictionary)
            }
        }
    }

    func testLegacyListsUseMultiSelectWithoutLosingValues() async throws {
        for shared in [false, true] {
            if shared {
                vault = temporary.appendingPathComponent("shared-vault")
                try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true)
            }
            let core = try await store(create: !shared)
            let values = ["One", " One ", "", "One", "[[项目]]", String(repeating: "x", count: 101), "two\nlines"]
            let encoded = String(data: try JSONSerialization.data(withJSONObject: values), encoding: .utf8)!
            let file: URL
            if shared {
                file = vault.appendingPathComponent("List.md")
                try Data("---\naliases: \(encoded)\nunknown: {nested: keep}\n---\nBody #keep".utf8).write(to: file)
            } else {
                file = try writeNote(id: UUID().uuidString.lowercased(), body: "Body #keep", extra: "aliases: \(encoded)\nunknown: {nested: keep}\n")
            }
            let config = vault.appendingPathComponent(propertyDefinitionPath)
            try FileManager.default.createDirectory(at: config.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Data("{\"aliases\":{\"type\":\"list\"}}".utf8).write(to: config)
            let original = try Data(contentsOf: file)
            let page = try await call(core, "queryNotes")
            let note = (page["notes"] as! [[String: Any]]).first { ($0["body"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) == "Body #keep" }!
            let id = note["id"] as! String
            let fields = try await call(core, "getNoteProperties", ["id": id])
            let property = (fields["properties"] as! [[String: Any]]).first { $0["name"] as? String == "aliases" }!
            XCTAssertEqual(property["type"] as? String, "multiSelect")
            XCTAssertEqual(property["value"] as? [String], values)
            XCTAssertEqual(try Data(contentsOf: file), original)
            var options = property["options"] as! [[String: String]]
            options.append(["name": "Added", "color": "blue"])
            let saved = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "definitionHash": fields["definitionHash"]!, "name": "aliases", "type": "multiSelect", "value": values + ["Added"], "options": options, "definition": true])
            XCTAssertEqual((saved["body"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), "Body #keep")
            XCTAssertTrue(try String(contentsOf: file, encoding: .utf8).contains("unknown: {nested: keep}"))
            if shared {
                try Data("---\naliases: [External]\n---\nOutside".utf8).write(to: vault.appendingPathComponent("Outside.md"))
            } else { _ = try writeNote(id: UUID().uuidString.lowercased(), body: "Outside", extra: "aliases: [External]\n") }
            let outsidePage = try await call(core, "queryNotes")
            let outside = (outsidePage["notes"] as! [[String: Any]]).first { ($0["body"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) == "Outside" }!
            options = options.map { ["name": $0["name"]!, "color": "green"] }
            let changed = try await call(core, "updateNoteProperty", ["id": id, "baseHash": saved["contentHash"]!, "name": "aliases", "type": "multiSelect", "value": values + ["Added"], "options": options, "definition": true])
            let external = try await call(core, "getNoteProperties", ["id": outside["id"]!])["properties"] as! [[String: Any]]
            XCTAssertEqual(external.first { $0["name"] as? String == "aliases" }?["value"] as? [String], ["External"])
            let reopened = try await store(create: !shared)
            _ = try await call(reopened, "saveNote", ["id": id, "body": "Edited body", "tags": [], "baseHash": changed["contentHash"]!])
            let after = try await call(reopened, "getNoteProperties", ["id": id])["properties"] as! [[String: Any]]
            XCTAssertEqual(after.first { $0["name"] as? String == "aliases" }?["value"] as? [String], values + ["Added"])
        }
    }
    func testLegacyOptionLimitDoesNotBlockCreationOrPruneValues() async throws {
        let core = try await store()
        let values = (0..<210).map { "Option \($0)" }
        let firstId = UUID().uuidString.lowercased(), secondId = UUID().uuidString.lowercased()
        for (id, items) in [(firstId, Array(values.prefix(105))), (secondId, Array(values.suffix(105)))] {
            let encoded = String(data: try JSONSerialization.data(withJSONObject: items), encoding: .utf8)!
            _ = try writeNote(id: id, body: id, extra: "field: \(encoded)\n")
        }
        for registered in [false, true] {
            if registered { try Data("{\"field\":{\"type\":\"list\"}}".utf8).write(to: vault.appendingPathComponent(propertyDefinitionPath)) }
            let preview = try await call(core, "getNoteProperties")["properties"] as! [[String: Any]]
            XCTAssertEqual((preview.first { $0["name"] as? String == "field" }?["options"] as? [Any])?.count, 200)
            _ = try await save(core, body: "New body")
            let note = try await call(core, "getNote", ["id": firstId])
            let fields = try await call(core, "getNoteProperties", ["id": firstId])
            let property = (fields["properties"] as! [[String: Any]]).first { $0["name"] as? String == "field" }!
            _ = try await call(core, "updateNoteProperty", ["id": firstId, "baseHash": note["contentHash"]!, "name": "field", "type": "multiSelect", "value": property["value"]!, "options": property["options"]!, "definition": true])
            let after = try await call(core, "getNoteProperties", ["id": secondId])["properties"] as! [[String: Any]]
            XCTAssertEqual(after.first { $0["name"] as? String == "field" }?["value"] as? [String], Array(values.suffix(105)))
        }
    }
    func testMixedSourceTypesKeepTheirValuesWhenCreatingSharedDefinition() async throws {
        let core = try await store()
        let firstId = UUID().uuidString.lowercased(), secondId = UUID().uuidString.lowercased()
        _ = try writeNote(id: firstId, body: "A", extra: "field: One # memocard:choice={\"type\":\"select\",\"options\":[{\"name\":\"One\",\"color\":\"blue\"}]}\n")
        _ = try writeNote(id: secondId, body: "B", extra: "field: Two\n")
        let note = try await call(core, "getNote", ["id": firstId])
        _ = try await call(core, "updateNoteProperty", ["id": firstId, "baseHash": note["contentHash"]!, "name": "field", "type": "multiSelect", "definition": true])
        let fields = try await call(core, "getNoteProperties", ["id": secondId])["properties"] as! [[String: Any]]
        XCTAssertEqual(fields.first { $0["name"] as? String == "field" }?["value"] as? [String], ["Two"])
    }
    func testLegacyListCopiesAndOptionRenamesPreserveLiteralValues() async throws {
        for shared in [false, true] {
            if shared {
                vault = temporary.appendingPathComponent("shared-copy")
                try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true)
            }
            let core = try await store(create: !shared), values = ["One", "One", "", " spaced "]
            let encoded = String(data: try JSONSerialization.data(withJSONObject: values), encoding: .utf8)!
            for body in ["A", "B"] {
                if shared { try Data("---\naliases: \(encoded)\n---\n\(body)".utf8).write(to: vault.appendingPathComponent("\(body).md")) }
                else { _ = try writeNote(id: UUID().uuidString.lowercased(), body: body, extra: "aliases: \(encoded)\n") }
            }
            let page = try await call(core, "queryNotes")["notes"] as! [[String: Any]]
            let a = page.first { ($0["body"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) == "A" }!
            let b = page.first { ($0["body"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) == "B" }!
            let fields = try await call(core, "getNoteProperties", ["id": a["id"]!])["properties"] as! [[String: Any]]
            let property = fields.first { $0["name"] as? String == "aliases" }!
            let copied = try await call(core, "updateNoteProperty", ["id": a["id"]!, "baseHash": a["contentHash"]!, "name": "aliases copy", "type": "multiSelect", "value": values, "options": property["options"]!, "create": true, "copyFrom": "aliases"])
            let afterCopy = try await call(core, "getNoteProperties", ["id": a["id"]!])["properties"] as! [[String: Any]]
            XCTAssertEqual(afterCopy.first { $0["name"] as? String == "aliases copy" }?["value"] as? [String], values)
            let changed = try await call(core, "updateNoteProperty", ["id": a["id"]!, "baseHash": copied["contentHash"]!, "name": "aliases", "type": "multiSelect", "value": ["Two", "Two", "", " spaced "], "options": [["name": "Two", "color": "blue"]], "definition": true, "optionRename": ["from": "One", "to": "Two"]])
            for id in [a["id"]!, b["id"]!] {
                let after = try await call(core, "getNoteProperties", ["id": id])["properties"] as! [[String: Any]]
                XCTAssertEqual(after.first { $0["name"] as? String == "aliases" }?["value"] as? [String], ["Two", "Two", "", " spaced "])
            }
            await expectCode("INVALID_PROPERTY") { _ = try await self.call(core, "updateNoteProperty", ["id": a["id"]!, "baseHash": changed["contentHash"]!, "name": "bad copy", "type": "multiSelect", "value": ["", "", ""], "options": [], "create": true, "copyFrom": "aliases"]) }
        }
    }
    func testPendingPropertiesSurviveReopenAndBodyCommit() async throws {
        for shared in [false, true] {
            let core = try await store(create: !shared)
            let id = UUID().uuidString.lowercased()
            let note = try await call(core, "saveNote", ["id": id, "title": "恢复属性", "body": "原文", "tags": [], "baseHash": NSNull()])
            let fieldName = "recovery-" + UUID().uuidString
            let pending: [[String: Any]] = [["id": id, "baseHash": note["contentHash"]!, "name": fieldName, "type": "text", "value": "保留属性", "create": true]]
            let input: [String: Any] = ["id": id, "title": note["title"]!, "body": "更新正文", "tags": [], "baseHash": note["contentHash"]!, "pendingProperties": pending]
            _ = try await call(core, "saveDraft", input)
            let reopened = try await store(create: !shared)
            let recoveredDrafts = try await call(reopened, "getDrafts")["drafts"] as? [[String: Any]]
            let recovered = try XCTUnwrap(recoveredDrafts?.first { $0["id"] as? String == id })
            XCTAssertEqual((recovered["pendingProperties"] as? [[String: Any]])?.first?["value"] as? String, "保留属性")
            let body = try await call(reopened, "saveNote", recovered)
            let retained = try await call(reopened, "getDrafts")["drafts"] as! [[String: Any]]
            XCTAssertTrue(retained.contains { $0["id"] as? String == id })
            let saved = try await call(reopened, "updateNoteProperty", pending[0].merging(["baseHash": body["contentHash"]!]) { _, value in value })
            XCTAssertEqual(saved["body"] as? String, "更新正文")
            let fields = try await call(reopened, "getNoteProperties", ["id": id])["properties"] as! [[String: Any]]
            XCTAssertEqual(fields.first { $0["name"] as? String == fieldName }?["value"] as? String, "保留属性")
        }
    }
    func testInheritedTagsStayInPropertiesForLegacyNotes() async throws { try await inheritedTagsStayInProperties(shared: false) }
    func testInheritedTagsStayInPropertiesForObsidianNotes() async throws { try await inheritedTagsStayInProperties(shared: true) }
    private func inheritedTagsStayInProperties(shared: Bool) async throws {
        let core = try await store(create: !shared)
        let id = UUID().uuidString.lowercased()
        let input: [String: Any] = ["id": id, "title": "实际标题", "body": "实际正文 #手动", "tags": ["手动"], "inheritedTags": ["生活/记录"], "baseHash": NSNull()]
        _ = try await call(core, "saveDraft", input)
        let reopened = try await store(create: !shared)
        let drafts = try await call(reopened, "getDrafts")
        let recovered = try XCTUnwrap((drafts["drafts"] as? [[String: Any]])?.first)
        XCTAssertEqual(recovered["inheritedTags"] as? [String], ["生活/记录"])
        let saved = try await call(reopened, "saveNote", recovered)
        XCTAssertEqual(saved["body"] as? String, "实际正文 #手动")
        XCTAssertEqual(saved["tags"] as? [String], ["生活/记录", "手动"])
        let properties = try await call(reopened, "getNoteProperties", ["id": id])
        XCTAssertEqual((properties["tagProperty"] as? [String: Any])?["value"] as? [String], ["生活/记录"])
        let afterSave = try await call(reopened, "getDrafts")
        XCTAssertEqual((afterSave["drafts"] as? [Any])?.count, 0)
        let edited = try await call(reopened, "saveNote", ["id": id, "body": "继续写", "tags": [], "baseHash": saved["contentHash"]!])
        XCTAssertEqual(edited["body"] as? String, "继续写")
        XCTAssertEqual(edited["tags"] as? [String], ["生活/记录"])
        let page = try await call(reopened, "queryNotes", ["tags": ["生活"]])
        XCTAssertEqual((page["notes"] as? [[String: Any]])?.first?["id"] as? String, id)
    }

    func testNewLegacyNotesInheritLibraryProperties() async throws { try await newNotesInheritLibraryProperties(shared: false) }
    func testNewObsidianNotesInheritLibraryProperties() async throws { try await newNotesInheritLibraryProperties(shared: true) }
    private func newNotesInheritLibraryProperties(shared: Bool) async throws {
        let core = try await store(create: !shared)
        let fields = "summary: Existing\naliases: [One]\nwhen: 2026-10-11\nchecked: true\nchoice: One # memocard:choice={\"type\":\"select\",\"options\":[{\"name\":\"One\",\"color\":\"purple\"}]}\nadvanced: {nested: keep}\n"
        let source: URL
        if shared {
            source = vault.appendingPathComponent("A.md")
            try Data(("---\n" + fields + "---\nBody A").utf8).write(to: source)
        } else { source = try writeNote(id: UUID().uuidString.lowercased(), filename: "A", body: "Body A", extra: fields) }
        let before = try Data(contentsOf: source)
        let config = vault.appendingPathComponent(propertyDefinitionPath)
        try Data(#"{"choice":{"type":"multiSelect","options":[{"name":"Shared","color":"green"}]},"registered":{"type":"text"}}"#.utf8).write(to: config)
        let preview = try await call(core, "getNoteProperties")
        let properties = preview["properties"] as! [[String: Any]]
        XCTAssertEqual(properties.map { $0["name"] as! String }, ["aliases", "checked", "choice", "registered", "summary", "when"])
        XCTAssertEqual(properties.first { $0["name"] as? String == "checked" }?["value"] as? Bool, false)
        XCTAssertEqual(properties.first { $0["name"] as? String == "when" }?["value"] as? String, "")
        XCTAssertEqual(properties.first { $0["name"] as? String == "choice" }?["type"] as? String, "multiSelect")
        XCTAssertEqual(properties.first { $0["name"] as? String == "choice" }?["value"] as? [String], [])
        XCTAssertEqual(properties.first { $0["name"] as? String == "choice" }?["options"] as? [[String: String]], [["name": "Shared", "color": "green"]])
        XCTAssertEqual(try Data(contentsOf: source), before)
        let initialPage = try await call(core, "queryNotes")
        XCTAssertEqual((initialPage["notes"] as! [[String: Any]]).count, 1)
        let note = try await save(core, body: "New content"), id = note["id"] as! String
        let saved = try await call(core, "getNoteProperties", ["id": id])
        XCTAssertEqual(saved["properties"] as! NSArray, properties as NSArray)
        XCTAssertEqual(note["body"] as? String, "New content")
        XCTAssertEqual(try Data(contentsOf: source), before)
        let reopened = try await store(create: !shared)
        let reloaded = try await call(reopened, "getNoteProperties", ["id": id])
        XCTAssertEqual(reloaded["properties"] as! NSArray, properties as NSArray)
        let edited = try await save(reopened, id: id, body: "Edited", hash: note["contentHash"] as? String)
        let afterEdit = try await call(reopened, "getNoteProperties", ["id": id])
        XCTAssertEqual(afterEdit["properties"] as! NSArray, properties as NSArray)
        try Data("{broken".utf8).write(to: config)
        await expectCode("INVALID_PROPERTY") { _ = try await self.save(reopened, body: "Must not create") }
        let finalPage = try await call(reopened, "queryNotes")
        XCTAssertEqual((finalPage["notes"] as! [[String: Any]]).count, 2)
        XCTAssertEqual(edited["body"] as? String, "Edited")
    }

    func testLegacyMissingLibraryFieldsStayVirtualUntilEdited() async throws { try await missingLibraryFieldsStayVirtual(shared: false) }
    func testObsidianMissingLibraryFieldsStayVirtualUntilEdited() async throws { try await missingLibraryFieldsStayVirtual(shared: true) }
    private func missingLibraryFieldsStayVirtual(shared: Bool) async throws {
        let core = try await store(create: !shared)
        let a = vault.appendingPathComponent(shared ? "A.md" : "notes/A.md"), b = vault.appendingPathComponent(shared ? "B.md" : "notes/B.md")
        if shared {
            try Data("---\nsummary: Original\n---\nBody A".utf8).write(to: a)
            try Data("Body B".utf8).write(to: b)
        } else {
            _ = try writeNote(id: UUID().uuidString.lowercased(), filename: "A", body: "Body A", extra: "summary: Original\n")
            _ = try writeNote(id: UUID().uuidString.lowercased(), filename: "B", body: "Body B")
        }
        let config = vault.appendingPathComponent(propertyDefinitionPath)
        try Data(#"{"choice":{"type":"select","options":[{"name":"One","color":"blue"}]},"checked":{"type":"checkbox"},"when":{"type":"date"}}"#.utf8).write(to: config)
        let page = try await call(core, "queryNotes")["notes"] as! [[String: Any]]
        let aid = page.first { $0["body"] as? String == "Body A" }!["id"] as! String, bid = page.first { $0["body"] as? String == "Body B" }!["id"] as! String
        let originalA = try Data(contentsOf: a), originalB = try Data(contentsOf: b)
        func fields(_ id: String) async throws -> [[String: Any]] { try await call(core, "getNoteProperties", ["id": id])["properties"] as! [[String: Any]] }
        let initial = try await fields(bid)
        XCTAssertEqual(initial.map { $0["name"] as! String }, ["checked", "choice", "summary", "when"])
        XCTAssertEqual(initial.first { $0["name"] as? String == "checked" }?["value"] as? Bool, false)
        XCTAssertEqual(initial.first { $0["name"] as? String == "summary" }?["value"] as? String, "")
        let aFields = try await fields(aid)
        XCTAssertEqual(aFields.first { $0["name"] as? String == "summary" }?["value"] as? String, "Original")
        XCTAssertEqual(try Data(contentsOf: a), originalA); XCTAssertEqual(try Data(contentsOf: b), originalB)
        let misses = await core.propertyParseMissCount
        _ = try await fields(bid)
        let warmMisses = await core.propertyParseMissCount
        XCTAssertEqual(warmMisses, misses)
        var note = try await call(core, "getNote", ["id": bid])
        note = try await save(core, id: bid, body: "Edited body", hash: note["contentHash"] as? String)
        XCTAssertFalse(String(decoding: try Data(contentsOf: b), as: UTF8.self).contains("summary:"))
        func change(_ params: [String: Any]) async throws -> [String: Any] {
            let note = try await call(core, "getNote", ["id": bid]), data = try await call(core, "getNoteProperties", ["id": bid])
            return try await call(core, "updateNoteProperty", params.merging(["id": bid, "baseHash": note["contentHash"]!, "definitionHash": data["definitionHash"]!]) { first, _ in first })
        }
        let beforeOptions = try Data(contentsOf: b)
        _ = try await change(["name": "choice", "type": "select", "value": "", "options": [["name": "One", "color": "purple"]], "definition": true])
        XCTAssertEqual(try Data(contentsOf: b), beforeOptions)
        _ = try await change(["name": "summary copy", "type": "text", "value": "", "create": true, "copyFrom": "summary"])
        var source = String(decoding: try Data(contentsOf: b), as: UTF8.self)
        XCTAssertTrue(source.contains("\"summary copy\": \"\"")); XCTAssertFalse(source.contains("\"summary\":"))
        let result = try await change(["name": "choice", "type": "select", "value": "One", "options": [["name": "One", "color": "purple"]]])
        let loaded = try await call(core, "getNoteProperties", ["id": bid])
        XCTAssertEqual(result["propertyData"] as! NSDictionary, loaded as NSDictionary)
        source = String(decoding: try Data(contentsOf: b), as: UTF8.self)
        XCTAssertTrue(source.contains("\"choice\": \"One\"")); XCTAssertFalse(source.contains("\"when\":")); XCTAssertFalse(source.contains("\"checked\":"))
        XCTAssertEqual(try Data(contentsOf: a), originalA)
        _ = try await change(["name": "when", "type": "date", "value": "2026-10-13"])
        _ = try await change(["name": "checked", "type": "checkbox", "value": true])
        _ = try await change(["name": "choice", "remove": true])
        let cleared = try await fields(bid)
        XCTAssertFalse(cleared.contains { $0["name"] as? String == "choice" })
        XCTAssertEqual(cleared.first { $0["name"] as? String == "when" }?["value"] as? String, "2026-10-13")
        XCTAssertEqual(cleared.first { $0["name"] as? String == "checked" }?["value"] as? Bool, true)
        let beforeRemove = try Data(contentsOf: b)
        await expectCode("INVALID_PROPERTY") { _ = try await change(["name": "choice", "remove": true]) }; XCTAssertEqual(try Data(contentsOf: b), beforeRemove)
        _ = try await change(["name": "new field", "type": "text", "value": "Value", "create": true])
        let inherited = try await fields(aid)
        XCTAssertEqual(inherited.first { $0["name"] as? String == "new field" }?["value"] as? String, "")
        XCTAssertEqual(try Data(contentsOf: a), originalA)
        let beforeReopen = try await fields(bid)
        let reopened = try await store(create: !shared)
        let afterReopen = try await call(reopened, "getNoteProperties", ["id": bid])["properties"] as! [[String: Any]]
        XCTAssertEqual(afterReopen as NSArray, beforeReopen as NSArray)
    }

    func testLegacyLibraryDeletionRemovesEveryValueAndDefinition() async throws { try await libraryDeletionRemovesEveryValue(shared: false) }
    func testObsidianLibraryDeletionRemovesEveryValueAndDefinition() async throws { try await libraryDeletionRemovesEveryValue(shared: true) }
    private func libraryDeletionRemovesEveryValue(shared: Bool) async throws {
        let core = try await store(create: !shared)
        var files: [URL] = []
        for index in 0..<3 {
            let name = ["A", "B", "C"][index], fields = (index < 2 ? "field: Value \(index)\n" : "") + "keep: Keep\n"
            if shared {
                let file = vault.appendingPathComponent("\(name).md")
                try Data("---\n\(fields)---\nBody \(index)".utf8).write(to: file); files.append(file)
            } else { files.append(try writeNote(id: UUID().uuidString.lowercased(), filename: name, body: "Body \(index)", extra: fields)) }
        }
        let config = vault.appendingPathComponent(propertyDefinitionPath)
        try Data(#"{"field":{"type":"text"},"onlySchema":{"type":"date"},"keep":{"type":"text"}}"#.utf8).write(to: config)
        let page = try await call(core, "queryNotes")["notes"] as! [[String: Any]]
        let c = page.first { $0["body"] as? String == "Body 2" }!, b = page.first { $0["body"] as? String == "Body 1" }!, cid = c["id"] as! String
        func fields(_ id: String) async throws -> [String: Any] { try await call(core, "getNoteProperties", ["id": id]) }
        let before = try Data(contentsOf: files[2]), initial = try await fields(cid), staleHash = initial["definitionHash"]!
        let result = try await call(core, "updateNoteProperty", ["id": cid, "baseHash": c["contentHash"]!, "definitionHash": staleHash, "name": "field", "remove": true])
        let current = try await fields(cid)
        XCTAssertEqual(result["propertyData"] as! NSDictionary, current as NSDictionary)
        for note in page {
            let values = try await fields(note["id"] as! String)["properties"] as! [[String: Any]]
            XCTAssertFalse(values.contains { $0["name"] as? String == "field" })
            XCTAssertEqual(values.first { $0["name"] as? String == "keep" }?["value"] as? String, "Keep")
        }
        for file in files { XCTAssertFalse(String(decoding: try Data(contentsOf: file), as: UTF8.self).contains("field:")) }
        XCTAssertEqual(try Data(contentsOf: files[2]), before)
        let definitions = try JSONSerialization.jsonObject(with: Data(contentsOf: config)) as! [String: Any]
        XCTAssertEqual(Set(definitions.keys), Set(["onlySchema", "keep"]))
        let freshB = try await call(core, "getNote", ["id": b["id"]!])
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "updateNoteProperty", ["id": b["id"]!, "baseHash": freshB["contentHash"]!, "definitionHash": staleHash, "name": "field", "type": "text", "value": "Stale"]) }
        _ = try await call(core, "updateNoteProperty", ["id": cid, "baseHash": c["contentHash"]!, "definitionHash": current["definitionHash"]!, "name": "onlySchema", "remove": true])
        XCTAssertEqual(try Data(contentsOf: files[2]), before)
        let preview = try await call(core, "getNoteProperties")["properties"] as! [[String: Any]]
        XCTAssertEqual(preview.map { $0["name"] as! String }, ["keep"])
        let saved = try await save(core, body: "New")
        let savedFields = try await fields(saved["id"] as! String)["properties"] as! [[String: Any]]
        XCTAssertEqual(savedFields.map { $0["name"] as! String }, ["keep"])
        let reopened = try await store(create: !shared)
        let reloaded = try await call(reopened, "getNoteProperties", ["id": b["id"]!])["properties"] as! [[String: Any]]
        XCTAssertEqual(reloaded.map { $0["name"] as! String }, ["keep"])
    }

    func testLibraryDeletionRejectsReadonlyValueWithoutPartialChanges() async throws {
        let core = try await store(), id = UUID().uuidString.lowercased()
        let a = try writeNote(id: id, filename: "A", extra: "field: One\n"), b = try writeNote(id: UUID().uuidString.lowercased(), filename: "B", extra: "field: {nested: keep}\n")
        let config = vault.appendingPathComponent(propertyDefinitionPath)
        try Data(#"{"field":{"type":"text"}}"#.utf8).write(to: config)
        let originals = try [a, b, config].map { try Data(contentsOf: $0) }, note = try await call(core, "getNote", ["id": id])
        await expectCode("INVALID_PROPERTY") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "field", "remove": true]) }
        XCTAssertEqual(try [a, b, config].map { try Data(contentsOf: $0) }, originals)
    }

    func testInterruptedLibraryDeletionRestoresEveryValueAndDefinition() async throws {
        let core = try await store()
        let ids = [UUID().uuidString.lowercased(), UUID().uuidString.lowercased()]
        let files = try ids.map { try writeNote(id: $0, extra: "field: Original\n") }
        let config = vault.appendingPathComponent(propertyDefinitionPath), definition = Data(#"{"field":{"type":"text"}}"#.utf8)
        try definition.write(to: config)
        _ = try await call(core, "queryNotes")
        let originals = try files.map { try Data(contentsOf: $0) }
        let after = try originals.enumerated().map { index, data in try patchNoteProperty(data, change: PropertyChange(id: ids[index], baseHash: "", name: "field", type: nil, value: nil, remove: true, create: nil)) }
        var changes = files.indices.map { ["path": "notes/\(ids[$0]).md", "before": originals[$0].base64EncodedString(), "after": after[$0].base64EncodedString()] }
        changes.append(["path": propertyDefinitionPath, "before": definition.base64EncodedString(), "after": Data("{}".utf8).base64EncodedString()])
        let journal = await core.identityURL.appendingPathExtension("rename.json")
        try JSONSerialization.data(withJSONObject: ["root": vault.path, "changes": changes, "identities": []]).write(to: journal)
        try after[0].write(to: files[0]); try Data("{}".utf8).write(to: config)
        let reopened = try await store()
        _ = try await call(reopened, "queryNotes")
        XCTAssertEqual(try files.map { try Data(contentsOf: $0) }, originals)
        XCTAssertEqual(try Data(contentsOf: config), definition)
        XCTAssertFalse(FileManager.default.fileExists(atPath: journal.path))
    }

    func testVaultPropertyDefinitionsSynchronizeTypesOptionsAndKeepValuesIndependent() async throws {
        try await verifySharedPropertyDefinitions(shared: false)
    }

    func testObsidianPropertyDefinitionsSynchronizeAndPersistAfterReopen() async throws {
        try await verifySharedPropertyDefinitions(shared: true)
    }

    private func verifySharedPropertyDefinitions(shared: Bool) async throws {
        let core = try await store(create: !shared)
        let aid = UUID().uuidString.lowercased(), bid = UUID().uuidString.lowercased()
        func choice(_ name: String, _ color: String) -> String {
            "field: \"\(name)\" # memocard:choice={\"type\":\"select\",\"options\":[{\"name\":\"\(name)\",\"color\":\"\(color)\"}]}\nother: keep\n"
        }
        if shared {
            try Data(("---\r\n" + choice("设计", "blue").replacingOccurrences(of: "\n", with: "\r\n") + "---\r\nBody A").utf8).write(to: vault.appendingPathComponent("A.md"))
            try Data(("---\n" + choice("开发", "green") + "---\nBody B").utf8).write(to: vault.appendingPathComponent("B.md"))
        } else {
            _ = try writeNote(id: aid, filename: "A", body: "Body A", extra: choice("设计", "blue"))
            _ = try writeNote(id: bid, filename: "B", body: "Body B", extra: choice("开发", "green"))
        }
        let unrelated = vault.appendingPathComponent(shared ? "Unrelated.md" : "notes/Unrelated.md")
        if shared { try Data("---\nunrelated: keep\n---\nUnrelated".utf8).write(to: unrelated) }
        else { _ = try writeNote(id: UUID().uuidString.lowercased(), filename: "Unrelated", body: "Unrelated", extra: "unrelated: keep\n") }
        let untouched = try Data(contentsOf: unrelated)
        let page = try await call(core, "queryNotes")["notes"] as! [[String: Any]]
        let firstID = page.first { ($0["relativePath"] as! String).hasSuffix("A.md") }!["id"] as! String
        let secondID = page.first { ($0["relativePath"] as! String).hasSuffix("B.md") }!["id"] as! String
        func fields(_ id: String) async throws -> [String: Any] { try await call(core, "getNoteProperties", ["id": id]) }
        func field(_ id: String) async throws -> [String: Any] { try await (fields(id)["properties"] as! [[String: Any]]).first { $0["name"] as? String == "field" }! }
        func change(_ options: [[String: String]], _ value: [String], _ extra: [String: Any] = [:]) async throws {
            let note = try await call(core, "getNote", ["id": firstID])
            let data = try await fields(firstID)
            var params: [String: Any] = ["id": firstID.uppercased(), "baseHash": note["contentHash"]!, "definitionHash": data["definitionHash"]!, "name": "field", "type": "multiSelect", "options": options, "value": value, "definition": true]
            params.merge(extra) { _, next in next }
            _ = try await call(core, "updateNoteProperty", params)
        }
        var options = [["name": "设计", "color": "blue"], ["name": "开发", "color": "green"]]
        let initial = try await fields(firstID), initialField = try await field(firstID)
        XCTAssertEqual(initialField["options"] as? [[String: String]], options)
        try await change(options, ["设计"])
        var a = try await field(firstID), b = try await field(secondID)
        XCTAssertEqual(a["type"] as? String, "multiSelect"); XCTAssertEqual(b["type"] as? String, "multiSelect")
        XCTAssertEqual(a["value"] as? [String], ["设计"]); XCTAssertEqual(b["value"] as? [String], ["开发"])
        let fresh = try await call(core, "getNote", ["id": secondID])
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "updateNoteProperty", ["id": secondID, "baseHash": fresh["contentHash"]!, "definitionHash": initial["definitionHash"]!, "name": "field", "type": "multiSelect", "value": [String]()]) }
        options[0]["color"] = "purple"
        try await change(options, ["设计"])
        b = try await field(secondID); XCTAssertEqual(b["options"] as? [[String: String]], options)
        options[1]["name"] = "工程"
        try await change(options, ["设计"], ["optionRename": ["from": "开发", "to": "工程"]])
        b = try await field(secondID); XCTAssertEqual(b["value"] as? [String], ["工程"])
        options.removeFirst()
        try await change(options, [])
        a = try await field(firstID); b = try await field(secondID)
        XCTAssertEqual(a["value"] as? [String], []); XCTAssertEqual(b["value"] as? [String], ["工程"])
        options.append(["name": "写作", "color": "blue"])
        try await change(options, ["写作"])
        let note = try await call(core, "getNote", ["id": secondID]), schema = try await fields(secondID)
        _ = try await call(core, "updateNoteProperty", ["id": secondID, "baseHash": note["contentHash"]!, "definitionHash": schema["definitionHash"]!, "name": "field", "type": "multiSelect", "value": [String](), "options": options])
        a = try await field(firstID); b = try await field(secondID)
        XCTAssertEqual(a["value"] as? [String], ["写作"]); XCTAssertEqual(b["value"] as? [String], [])
        XCTAssertEqual(try Data(contentsOf: unrelated), untouched)
        for (id, body) in [(firstID, "Body A"), (secondID, "Body B")] {
            let current = try await call(core, "getNote", ["id": id])
            XCTAssertEqual(current["body"] as? String, body)
            let properties = try await fields(id)["properties"] as! [[String: Any]]
            XCTAssertEqual(properties.first { $0["name"] as? String == "other" }?["value"] as? String, "keep")
        }
        let reopened = try await store(create: false)
        let persisted = try await call(reopened, "getNoteProperties", ["id": secondID])["properties"] as! [[String: Any]]
        let persistedField = persisted.first { $0["name"] as? String == "field" }!
        XCTAssertEqual(persistedField["type"] as? String, "multiSelect")
        XCTAssertEqual(persistedField["options"] as? [[String: String]], options)
        XCTAssertEqual(persistedField["value"] as? [String], [])
        try Data("{broken".utf8).write(to: vault.appendingPathComponent(propertyDefinitionPath))
        await expectCode("INVALID_PROPERTY") { _ = try await self.call(reopened, "getNoteProperties", ["id": firstID]) }
    }

    func testSharedDefinitionRejectsReadonlyNotesWithoutPartialChanges() async throws {
        let core = try await store(), id = UUID().uuidString.lowercased()
        let a = try writeNote(id: id, body: "A", extra: "field: One\n")
        let b = try writeNote(id: UUID().uuidString.lowercased(), body: "B", extra: "field: {nested: Two}\n")
        let originals = try [Data(contentsOf: a), Data(contentsOf: b)]
        let note = try await call(core, "getNote", ["id": id])
        await expectCode("INVALID_PROPERTY") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "field", "type": "list", "definition": true]) }
        XCTAssertEqual(try [Data(contentsOf: a), Data(contentsOf: b)], originals)
        XCTAssertFalse(FileManager.default.fileExists(atPath: vault.appendingPathComponent(propertyDefinitionPath).path))
    }

    func testInterruptedPropertyDefinitionBatchRestoresNotesAndRegistry() async throws {
        let core = try await store(), id = UUID().uuidString.lowercased()
        let file = try writeNote(id: id, body: "Body", extra: "field: One\n")
        _ = try await call(core, "queryNotes")
        let original = try Data(contentsOf: file), after = Data("partial note update".utf8)
        let config = vault.appendingPathComponent(propertyDefinitionPath), definition = Data("{\"field\":{\"type\":\"list\"}}".utf8)
        let journal = await core.identityURL.appendingPathExtension("rename.json")
        let changes: [[String: Any]] = [["path": "notes/\(id).md", "before": original.base64EncodedString(), "after": after.base64EncodedString()], ["path": propertyDefinitionPath, "after": definition.base64EncodedString()]]
        let encoded = try JSONSerialization.data(withJSONObject: ["root": vault.path, "changes": changes, "identities": []])
        try after.write(to: file); try definition.write(to: config); try encoded.write(to: journal)
        _ = try await call(core, "queryNotes")
        XCTAssertEqual(try Data(contentsOf: file), original)
        XCTAssertFalse(FileManager.default.fileExists(atPath: config.path))
        try after.write(to: file); try Data("external config".utf8).write(to: config); try encoded.write(to: journal)
        await expectCode("RENAME_RECOVERY_REQUIRED") { _ = try await self.call(core, "queryNotes") }
        XCTAssertEqual(try String(contentsOf: config, encoding: .utf8), "external config")
        XCTAssertEqual(try Data(contentsOf: file), after)
        XCTAssertTrue(FileManager.default.fileExists(atPath: journal.path))
    }

    func testVaultPropertyLabelsPersistWithoutRewritingNotesAndRejectConflicts() async throws {
        let core = try await store()
        let first = try writeNote(id: UUID().uuidString.lowercased(), body: "First", extra: "summary: One\n")
        let second = try writeNote(id: UUID().uuidString.lowercased(), body: "Second", extra: "summary: Two\n")
        let originals = try [Data(contentsOf: first), Data(contentsOf: second)]
        let initial = try await call(core, "getPropertyLabels")
        var labels = try await call(core, "renamePropertyLabel", ["key": "system:tags", "label": "分类", "baseHash": initial["contentHash"]!])
        labels = try await call(core, "renamePropertyLabel", ["key": "property:summary", "label": "摘要", "baseHash": labels["contentHash"]!])
        XCTAssertEqual(labels["labels"] as? [String: String], ["system:tags": "分类", "property:summary": "摘要"])
        XCTAssertEqual(try [Data(contentsOf: first), Data(contentsOf: second)], originals)
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "renamePropertyLabel", ["key": "system:createdAt", "label": "时间", "baseHash": initial["contentHash"]!]) }
        for (key, label) in [("system:createdAt", "摘要"), ("system:createdAt", "文件名"), ("system:createdAt", " "), ("property:missing", "缺失")] {
            await expectCode("INVALID_PROPERTY") { _ = try await self.call(core, "renamePropertyLabel", ["key": key, "label": label, "baseHash": labels["contentHash"]!]) }
        }
        let reopened = try await store(create: false)
        let persisted = try await call(reopened, "getPropertyLabels")
        XCTAssertEqual(persisted["labels"] as? [String: String], labels["labels"] as? [String: String])
        let config = vault.appendingPathComponent(".memocard/property-labels.json")
        try Data("{broken".utf8).write(to: config)
        await expectCode("INVALID_PROPERTY") { _ = try await self.call(core, "getPropertyLabels") }
        XCTAssertEqual(try String(contentsOf: config, encoding: .utf8), "{broken")
    }

    func testPropertyLabelsForObsidianNotesPreserveIndividualValuesAndSource() async throws {
        let a = vault.appendingPathComponent("A.md"), b = vault.appendingPathComponent("B.md")
        let first = Data("---\r\nsummary: One # keep\r\n---\r\nFirst".utf8), second = Data("---\nsummary: Two\n---\nSecond".utf8)
        try first.write(to: a); try second.write(to: b)
        let core = try await store(create: false)
        let initial = try await call(core, "getPropertyLabels")
        let saved = try await call(core, "renamePropertyLabel", ["key": "property:summary", "label": "摘要", "baseHash": initial["contentHash"]!])
        XCTAssertEqual(saved["labels"] as? [String: String], ["property:summary": "摘要"])
        XCTAssertEqual(try Data(contentsOf: a), first); XCTAssertEqual(try Data(contentsOf: b), second)
        let reopened = try await store(create: false)
        let persisted = try await call(reopened, "getPropertyLabels")
        XCTAssertEqual(persisted["labels"] as? [String: String], saved["labels"] as? [String: String])
    }
    func testNumbersAndOptionalDateTimesSurviveBodySaveAndReopen() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        let url = try writeNote(id: id, body: "Body #keep\n", extra: "unknown: {nested: value}\n")
        var note = try await call(core, "getNote", ["id": id])
        for (name, type) in [("weight", "number"), ("due", "date")] {
            note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": name, "type": type, "value": "", "create": true])
        }
        for value in ["0", "-3", "3.2", "9007199254740993", "3.0000000000000001", "1e3", ""] {
            note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "weight", "type": "number", "value": value])
            note = try await save(core, id: id, body: "Edited #keep\n", hash: note["contentHash"] as? String)
            let fields = try await call(core, "getNoteProperties", ["id": id])
            let field = (fields["properties"] as? [[String: Any]])?.first { $0["name"] as? String == "weight" }
            XCTAssertEqual(field?["type"] as? String, "number"); XCTAssertEqual(field?["value"] as? String, value)
        }
        for value in ["2026-10-13T09:30:42.123+08:00", "2026-10-13T01:30:42.123Z", "2026-10-13", ""] {
            note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "due", "type": "date", "value": value])
            note = try await save(core, id: id, body: "Edited #keep\n", hash: note["contentHash"] as? String)
            let reopened = try await store(create: false)
            let fields = try await call(reopened, "getNoteProperties", ["id": id])
            let field = (fields["properties"] as? [[String: Any]])?.first { $0["name"] as? String == "due" }
            XCTAssertEqual(field?["type"] as? String, "date"); XCTAssertEqual(field?["value"] as? String, value)
        }
        for (name, type, value) in [("weight", "number", "NaN"), ("weight", "number", "01"), ("weight", "number", "1e999"), ("due", "date", "2026-02-30T09:30:00Z"), ("due", "date", "2026-10-13T24:00:00Z")] {
            await expectCode("INVALID_PROPERTY") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": name, "type": type, "value": value]) }
        }
        XCTAssertTrue(try String(contentsOf: url, encoding: .utf8).hasSuffix("Edited #keep\n"))
        XCTAssertTrue(validPropertyDefinition(PropertyDefinition(type: "number")))
        XCTAssertEqual(convertedProperty(NoteProperty(name: "weight", type: "text", value: .text("3.2"), editable: true), definition: PropertyDefinition(type: "number")).type, "number")
    }

    func testImagePropertySurvivesBodySaveReopenAndClear() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        let url = try writeNote(id: id, body: "Body #keep\n", extra: "unknown: {nested: value}\n")
        var note = try await call(core, "getNote", ["id": id])
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "cover", "type": "image", "value": "", "create": true])
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "cover", "type": "image", "value": "../assets/cover.png"])
        note = try await save(core, id: id, body: "Edited #keep\n", hash: note["contentHash"] as? String)
        let reopened = try await store(create: false)
        var fields = try await call(reopened, "getNoteProperties", ["id": id])
        var cover = (fields["properties"] as? [[String: Any]])?.first { $0["name"] as? String == "cover" }
        XCTAssertEqual(cover?["type"] as? String, "image")
        XCTAssertEqual(cover?["value"] as? String, "../assets/cover.png")
        let raw = try String(contentsOf: url, encoding: .utf8)
        XCTAssertTrue(raw.contains("nested")); XCTAssertTrue(raw.hasSuffix("Edited #keep\n"))
        for path in ["https://example.com/a.png", "/tmp/a.png", "assets/.hidden.png", "assets/a.txt", "assets/%2e%2e/a.png", "assets/%2fetc.png"] {
            await expectCode("INVALID_PROPERTY") { _ = try await self.call(reopened, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "cover", "type": "image", "value": path]) }
        }
        note = try await call(reopened, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "cover", "type": "image", "value": ""])
        fields = try await call(reopened, "getNoteProperties", ["id": id])
        cover = (fields["properties"] as? [[String: Any]])?.first { $0["name"] as? String == "cover" }
        XCTAssertEqual(cover?["type"] as? String, "image"); XCTAssertEqual(cover?["value"] as? String, "")
    }

    func testPropertyTypeSwitchPersistsTextDateAndChoiceTypesAfterBodySave() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        let url = try writeNote(id: id, body: "Body #keep\n", extra: "field: 2028-02-29\nunknown: {nested: value}\n")
        var note = try await call(core, "getNote", ["id": id])
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "field", "type": "text", "value": "2028-02-29"])
        XCTAssertTrue(try String(contentsOf: url, encoding: .utf8).contains("\"field\": \"2028-02-29\" # memocard:type=text"))
        note = try await save(core, id: id, body: "Saved body #keep\n", hash: note["contentHash"] as? String)
        var fields = try await call(core, "getNoteProperties", ["id": id])
        XCTAssertEqual((fields["properties"] as? [[String: Any]])?.first?["type"] as? String, "text")
        for (type, value) in [("multiSelect", ["2028-02-29"] as Any), ("select", "2028-02-29" as Any), ("date", "2028-02-29" as Any), ("checkbox", false as Any)] {
            var params: [String: Any] = ["id": id, "baseHash": note["contentHash"]!, "name": "field", "type": type, "value": value]
            if type == "select" || type == "multiSelect" { params["options"] = [["name": "2028-02-29", "color": "purple"]] }
            note = try await call(core, "updateNoteProperty", params)
            fields = try await call(core, "getNoteProperties", ["id": id])
            XCTAssertEqual((fields["properties"] as? [[String: Any]])?.first?["type"] as? String, type)
            XCTAssertEqual(note["body"] as? String, "Saved body #keep\n")
        }
        let reopened = try await store(create: false)
        fields = try await call(reopened, "getNoteProperties", ["id": id])
        XCTAssertEqual((fields["properties"] as? [[String: Any]])?.first?["type"] as? String, "checkbox")
        let raw = try String(contentsOf: url, encoding: .utf8)
        XCTAssertTrue(raw.contains("nested")); XCTAssertFalse(raw.contains("memocard:"))
        for suffix in ["# memocard:type=text extra", "# user # memocard:type=text"] {
            XCTAssertEqual(try readNoteProperties(Data("---\nfield: \"2028-02-29\" \(suffix)\n---\nBody".utf8)).properties[0].type, "date")
        }
    }
    func testPropertyRenamePreservesSourceMetadataAndRejectsUnsafeChanges() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        let extra = "\"old: name\"  : \"设计\" # memocard:choice={\"type\":\"select\",\"options\":[{\"name\":\"设计\",\"color\":\"purple\"}]}\n# keep\naliases:\n  - One # item\n  - Two\nempty: null # memocard:type=date\n"
        let url = try writeNote(id: id, body: "Body #keep\n", extra: extra)
        let initial = try await call(core, "getNote", ["id": id])
        var note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": initial["contentHash"]!, "name": "old: name", "renameTo": "新名称: 引用"])
        let raw = try String(contentsOf: url, encoding: .utf8)
        XCTAssertTrue(raw.contains(extra.replacingOccurrences(of: "\"old: name\"", with: "\"新名称: 引用\"")))
        XCTAssertTrue(raw.hasSuffix("Body #keep\n"))
        for (name, target) in [("新名称: 引用", "aliases"), ("新名称: 引用", "id"), ("新名称: 引用", "tags"), ("新名称: 引用", " "), ("missing", "new")] {
            await expectCode("INVALID_PROPERTY") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": name, "renameTo": target]) }
        }
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": initial["contentHash"]!, "name": "新名称: 引用", "renameTo": "new"]) }
        XCTAssertEqual(try String(contentsOf: url, encoding: .utf8), raw)
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "aliases", "renameTo": "别名"])
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "empty", "renameTo": "日期"])
        let reopened = try await store(create: false)
        let fields = try await call(reopened, "getNoteProperties", ["id": id])
        let properties = try XCTUnwrap(fields["properties"] as? [[String: Any]])
        XCTAssertEqual(properties.map { $0["name"] as! String }, ["新名称: 引用", "别名", "日期"])
        XCTAssertEqual(properties.map { $0["type"] as! String }, ["select", "multiSelect", "date"])
        XCTAssertEqual((properties[0]["options"] as? [[String: String]])?.first?["color"], "purple")
        XCTAssertTrue(try String(contentsOf: url, encoding: .utf8).contains("\"别名\":\n  - One # item\n  - Two"))
    }
    func testPropertyRenamePreservesBOMCRLFAndQuotedKeys() throws {
        let source = "\u{FEFF}---\r\n'old: ''name' : [One, Two] # keep\r\n---\r\nBody\r\n"
        let change = try JSONDecoder().decode(PropertyChange.self, from: JSONSerialization.data(withJSONObject: ["id": "id", "baseHash": "hash", "name": "old: 'name", "renameTo": "新名称"]))
        let saved = try patchNoteProperty(Data(source.utf8), change: change)
        XCTAssertEqual(String(decoding: saved, as: UTF8.self), source.replacingOccurrences(of: "'old: ''name'", with: "\"新名称\""))
    }
    func testPropertyTagEditingPreservesBodyAndMergesIndexWithoutDuplicateCounts() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        let body = "正文 #共享 #正文/分类\n\n`#忽略`\n"
        let url = try writeNote(id: id, body: body, extra: "# keep\ncustom: value\n")
        let initial = try await call(core, "getNote", ["id": id])
        let saved = try await call(core, "updateNoteProperty", ["id": id, "baseHash": initial["contentHash"]!, "name": "tags", "type": "list", "value": ["#共享", " 属性/分类 ", "共享"]])
        XCTAssertEqual(saved["tags"] as? [String], ["共享", "属性/分类", "正文/分类"])
        XCTAssertEqual(saved["body"] as? String, body)
        let fields = try await call(core, "getNoteProperties", ["id": id])
        XCTAssertEqual((fields["tagProperty"] as? [String: Any])?["value"] as? [String], ["共享", "属性/分类"])
        let page = try await call(core, "queryNotes", ["tags": ["属性"]])
        XCTAssertEqual((page["notes"] as? [[String: Any]])?.count, 1)
        let listed = try await call(core, "listTags")
        XCTAssertEqual((listed["tags"] as? [[String: Any]])?.first { $0["name"] as? String == "共享" }?["count"] as? Int, 1)
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": initial["contentHash"]!, "name": "tags", "type": "list", "value": []]) }
        let cleared = try await call(core, "updateNoteProperty", ["id": id, "baseHash": saved["contentHash"]!, "name": "tags", "type": "list", "value": []])
        XCTAssertEqual(cleared["tags"] as? [String], ["共享", "正文/分类"])
        let raw = try Data(contentsOf: url)
        XCTAssertTrue(String(decoding: raw, as: UTF8.self).hasSuffix("# keep\ncustom: value\n---\n" + body))
        await expectCode("INVALID_PROPERTY") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": cleared["contentHash"]!, "name": "tags", "type": "list", "value": ["bad tag"]]) }
        XCTAssertEqual(try Data(contentsOf: url), raw)
        let reopened = try await store(create: false)
        let loaded = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual(loaded["tags"] as? [String], ["共享", "正文/分类"])
    }
    func testCompatibleTagPropertyUpsertPreservesBOMCRLFAndMalformedTagsStayReadOnly() throws {
        let source = "\u{FEFF}---\r\n# keep\r\ncustom: value\r\n---\r\n正文 #共享\r\n"
        let change = try JSONDecoder().decode(PropertyChange.self, from: JSONSerialization.data(withJSONObject: ["id": "id", "baseHash": "hash", "name": "tags", "type": "list", "value": ["#共享", "属性/分类"]]))
        let saved = try patchNoteProperty(Data(source.utf8), change: change)
        XCTAssertTrue(String(decoding: saved, as: UTF8.self).hasPrefix("\u{FEFF}---\r\n# keep\r\ncustom: value\r\n"))
        XCTAssertTrue(String(decoding: saved, as: UTF8.self).hasSuffix("---\r\n正文 #共享\r\n"))
        let identity = FileIdentity(id: "id", path: "Note.md", hash: "", createdAt: timestamp())
        let parsed = try parseObsidianNote(saved, relativePath: "Note.md", vaultID: "vault", identity: identity, modified: Date())
        XCTAssertEqual(parsed.note.tags, ["共享", "属性/分类"])
        for yaml in ["tags: [valid, 123]", "tags: {nested: value}", "tags: |\n  value", "tags: &ref [valid]"] {
            let bytes = Data("---\n\(yaml)\n---\nBody #keep".utf8)
            XCTAssertFalse(try readNoteProperties(bytes).tagProperty.editable)
            XCTAssertThrowsError(try patchNoteProperty(bytes, change: change))
        }
    }
    func testPropertyCRUDPreservesUnknownYAMLAndChecksSourceHash() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        let url = try writeNote(id: id, body: "# Body\n\n<!-- raw -->\n")
        var source = try String(contentsOf: url, encoding: .utf8)
        source = source.replacingOccurrences(of: "---\n# Body", with: "# keep\nsummary: old\nunknown: {nested: [1, two]}\n---\n# Body")
        try Data(source.utf8).write(to: url)
        var note = try await call(core, "getNote", ["id": id])
        let oldHash = note["contentHash"]!
        for (name, type, value) in [("summary", "text", "new: #literal" as Any), ("aliases", "multiSelect", ["One", "Two"] as Any), ("due", "date", "2026-10-12" as Any), ("done", "checkbox", false as Any)] {
            note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": name, "type": type, "value": value, "create": name != "summary"])
        }
        let raw = try String(contentsOf: url, encoding: .utf8)
        XCTAssertTrue(raw.contains("# keep\n\"summary\": \"new: #literal\"\nunknown: {nested: [1, two]}"))
        XCTAssertTrue(raw.hasSuffix("# Body\n\n<!-- raw -->\n"))
        let fields = try await call(core, "getNoteProperties", ["id": id])
        let values = try XCTUnwrap(fields["properties"] as? [[String: Any]])
        XCTAssertEqual(values.map { $0["type"] as! String }, ["text", "unsupported", "multiSelect", "date", "checkbox"])
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": oldHash, "name": "summary", "remove": true]) }
        await expectCode("INVALID_PROPERTY") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "id", "type": "text", "value": "bad"]) }
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "summary", "remove": true])
        let reopened = try await store()
        let loaded = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual(note["contentHash"] as? String, loaded["contentHash"] as? String)
        XCTAssertEqual(loaded["body"] as? String, "# Body\n\n<!-- raw -->\n")
    }
    func testCompatiblePropertiesPreserveBOMCRLFAndRejectAdvancedSyntax() async throws {
        try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true)
        let url = vault.appendingPathComponent("属性.md")
        let source = "\u{FEFF}---\r\n# keep\r\naliases: [One, Two]\r\nunknown: {nested: value}\r\n---\r\n# Body\r\n"
        try Data(source.utf8).write(to: url)
        let core = try await store(create: false)
        let page = try await call(core, "queryNotes")
        let note = (page["notes"] as! [[String: Any]])[0]
        _ = try await call(core, "updateNoteProperty", ["id": note["id"]!, "baseHash": note["contentHash"]!, "name": "aliases", "type": "multiSelect", "value": ["New", "Two"], "options": [["name": "New", "color": "default"], ["name": "Two", "color": "default"]]])
        let updated = String(decoding: try Data(contentsOf: url), as: UTF8.self)
        XCTAssertTrue(updated.hasPrefix("\u{FEFF}---\r\n# keep\r\n"))
        XCTAssertTrue(updated.hasSuffix("unknown: {nested: value}\r\n---\r\n# Body\r\n"))
        let advanced = Data("---\nfirst: &ref value\nsecond: *ref\n---\nBody".utf8)
        XCTAssertFalse(try readNoteProperties(advanced).writable)
        let change = try JSONDecoder().decode(PropertyChange.self, from: JSONSerialization.data(withJSONObject: ["id": note["id"]!, "baseHash": "hash", "name": "first", "type": "text", "value": "new"]))
        XCTAssertThrowsError(try patchNoteProperty(advanced, change: change))
    }

    func testEmptyPropertiesPreserveTypesAfterReopenAndDateClear() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        _ = try writeNote(id: id, body: "Body #keep\n")
        var note = try await call(core, "getNote", ["id": id])
        for (name, type, value) in [("empty text", "text", "" as Any), ("empty list", "multiSelect", [String]() as Any), ("empty date", "date", "" as Any), ("unchecked", "checkbox", false as Any)] {
            note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": name, "type": type, "value": value, "create": true])
        }
        let reopened = try await store(create: false)
        note = try await save(reopened, id: id, body: "Body #keep\n", hash: note["contentHash"] as? String)
        note = try await call(reopened, "saveNote", ["id": id, "baseHash": note["contentHash"]!, "body": "Body #keep\n", "tags": [], "title": "Empty property renamed"])
        let renamedURL = vault.appendingPathComponent(note["relativePath"] as! String)
        let fields = try await call(reopened, "getNoteProperties", ["id": id])
        let values = try XCTUnwrap(fields["properties"] as? [[String: Any]])
        XCTAssertEqual(values.map { $0["type"] as! String }, ["text", "multiSelect", "date", "checkbox"])
        XCTAssertEqual(values[2]["value"] as? String, "")
        XCTAssertEqual(values[3]["value"] as? Bool, false)
        note = try await call(reopened, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "empty date", "type": "date", "value": "2028-02-29"])
        note = try await call(reopened, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "empty date", "type": "date", "value": ""])
        let raw = try String(contentsOf: renamedURL, encoding: .utf8)
        XCTAssertTrue(raw.contains("\"empty date\": null # memocard:type=date\n"))
        XCTAssertTrue(raw.hasSuffix("Body #keep\n"))
        let loaded = try readNoteProperties(Data(raw.utf8))
        XCTAssertEqual(loaded.properties[2].type, "date")
        if case .text(let value) = loaded.properties[2].value { XCTAssertEqual(value, "") } else { XCTFail("Expected empty date") }
        _ = try await call(reopened, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "empty date", "remove": true])
        XCTAssertFalse(try String(contentsOf: renamedURL, encoding: .utf8).contains("memocard:type=date"))
    }
    func testEmptyDateMarkerPreservesBOMCRLFAndDoesNotRetypeOrdinaryNulls() throws {
        let source = "\u{FEFF}---\r\n# keep\r\nunknown: null # user comment\r\n---\r\nBody\r\n"
        let change = try JSONDecoder().decode(PropertyChange.self, from: JSONSerialization.data(withJSONObject: ["id": "id", "baseHash": "hash", "name": "due", "type": "date", "value": "", "create": true]))
        let saved = try patchNoteProperty(Data(source.utf8), change: change)
        let raw = String(decoding: saved, as: UTF8.self)
        XCTAssertTrue(raw.hasPrefix("\u{FEFF}---\r\n# keep\r\nunknown: null # user comment\r\n"))
        XCTAssertTrue(raw.hasSuffix("---\r\nBody\r\n"))
        XCTAssertEqual(try readNoteProperties(saved).properties.map(\.type), ["unsupported", "date"])
        for field in ["due: null", "due: null # memocard:type=text", "due: null # memocard:type=date extra", "due: 123 # memocard:type=date", "due: \"\" # memocard:type=date"] {
            XCTAssertNotEqual(try readNoteProperties(Data("---\n\(field)\n---\nBody".utf8)).properties[0].type, "date")
        }
    }

    func testQuickFilterMarkdownSyntax() {
        let cases: [(String, Set<NoteQuickFilter>)] = [
            ("![照片][photo]\n\n[photo]: https://example.com/photo.png", [.untagged, .images]),
            ("[资料][]\n\n[资料]: https://example.com", [.untagged, .links]),
            ("[unused]: https://example.com\n<!-- ![隐藏](photo.png) -->", [.untagged]),
            ("<img src=\"https://example.com/photo.png\">", [.untagged, .images]),
            ("www.example.com", [.untagged, .links]),
            ("正文[^1]\n\n[^1]: 只有脚注内容。", [.untagged]),
            ("```\n![代码](photo.png) https://example.com", [.untagged]),
        ]
        for (body, expected) in cases {
            let note = Note(title: nil, id: "test", body: body, tags: [], createdAt: "", updatedAt: "", deletedAt: nil, contentHash: "", relativePath: "", sourceUrl: "")
            XCTAssertEqual(noteQuickFilters(note), expected, body)
        }
    }

    func testQuickFiltersShareUnicodeClassificationWithBrowser() throws {
        struct Fixture: Decodable { let body: String; let expected: Set<NoteQuickFilter> }
        let package = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let fixture = package.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("tests/fixtures/note-filters-unicode.json")
        let cases = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: fixture))
        for item in cases {
            for prefix in ["", "[plain]\n", String(repeating: "普通正文 café 👩🏽‍💻 #工作/设计\n", count: 80)] {
                for tags in [[], ["工作/设计"]] {
                    let note = Note(title: nil, id: "test", body: prefix + item.body, tags: tags, createdAt: "", updatedAt: "", deletedAt: nil, contentHash: "", relativePath: "", sourceUrl: "")
                    XCTAssertEqual(noteQuickFilters(note), tags.isEmpty ? item.expected.union([.untagged]) : item.expected, item.body)
                }
            }
        }
    }

    func testQuickFilterGuardPreservesLongUnicodeAndCaseInsensitiveMarkdown() {
        let prefix = String(repeating: "普通正文 café 👩🏽‍💻 #工作/设计\n", count: 80)
        let cases: [(String, Set<NoteQuickFilter>)] = [
            ("只是正文 www 和 https 字样", []),
            ("HTTPS://EXAMPLE.COM/资料", [.links]),
            ("HTTP://example.com", [.links]),
            ("WWW.example.com", [.links]),
            ("httpſ://example.com", []),
            ("[资料](local.md)", [.links]),
            ("[[资料]]", [.links]),
            ("![照片](照片.png)", [.images]),
            ("<IMG SRC=\"照片.png\">", [.images]),
            ("<A HREF=\"local.md\">资料</A>", [.links]),
            ("<!-- HTTPS://hidden.example -->", []),
            ("`WWW.hidden.example`", []),
            ("```\nHTTPS://hidden.example\n```", []),
            ("    HTTPS://hidden.example", []),
            ("[unused]: HTTPS://hidden.example", []),
        ]
        for (body, expected) in cases {
            for tags in [[], ["工作/设计"]] {
                let note = Note(title: nil, id: "test", body: prefix + body, tags: tags, createdAt: "", updatedAt: "", deletedAt: nil, contentHash: "", relativePath: "", sourceUrl: "")
                XCTAssertEqual(noteQuickFilters(note), tags.isEmpty ? expected.union([.untagged]) : expected, body)
            }
        }
    }

    func testRepeatedInlineTagsKeepUnicodeNormalizationAndFirstOccurrenceOrder() {
        let body = String(repeating: "#WORK #work #工作/设计 #123 #456 #__ #-- #工作/设计 ", count: 80)
        XCTAssertEqual(inlineTags(body + "#Café #Cafe\u{301} #Å #Å #第二项"), ["work", "工作/设计", "__", "--", "café", "cafe", "å", "第二项"])
        XCTAssertEqual(inlineTags("`#WORK`\n    #工作/设计\n````\n#Café\n````\n(#第二项) #WORK"), ["第二项", "work"])
    }

    func testSharedMarkdownExpressionsRemainConsistentAcrossConcurrentReaders() async {
        let matched = await withTaskGroup(of: Bool.self) { group in
            for worker in 0..<8 {
                group.addTask {
                    for n in 0..<50 {
                        let body = "#工作/设计 #WORK #work 👩🏽‍💻 \(worker)-\(n)\n" + (n.isMultiple(of: 2) ? "HTTPS://example.com" : "ordinary text")
                        let tags = inlineTags(body)
                        let note = Note(title: nil, id: "test", body: body, tags: tags, createdAt: "", updatedAt: "", deletedAt: nil, contentHash: "", relativePath: "", sourceUrl: "")
                        if tags != ["工作/设计", "work"] || noteQuickFilters(note) != (n.isMultiple(of: 2) ? [.links] : []) { return false }
                    }
                    return true
                }
            }
            for await value in group { if !value { return false } }
            return true
        }
        XCTAssertTrue(matched)
    }

    func testQuickFiltersBeforePaginationAndGlobalCounts() async throws {
        let core = try await store()
        let linked = try await save(core, body: "#工作 ![照片](photo.png) https://example.com")
        let image = try await save(core, body: "![[photo.PNG|照片]]")
        let code = try await save(core, body: "`https://example.com`\n```md\n![代码](photo.png) https://example.com\n```\n    [[代码]]")
        let first = try await call(core, "queryNotes", ["quickFilter": "images", "limit": 1])
        XCTAssertEqual(first["filterCounts"] as? [String: Int], ["untagged": 2, "images": 2, "links": 1])
        let firstNotes = try XCTUnwrap(first["notes"] as? [[String: Any]])
        XCTAssertEqual(firstNotes.count, 1)
        let cursor = try XCTUnwrap(first["nextCursor"] as? String)
        let second = try await call(core, "queryNotes", ["quickFilter": "images", "limit": 1, "cursor": cursor])
        let secondNotes = try XCTUnwrap(second["notes"] as? [[String: Any]])
        XCTAssertEqual(secondNotes.count, 1)
        XCTAssertNotEqual(firstNotes.first?["id"] as? String, secondNotes.first?["id"] as? String)
        XCTAssertTrue(second["nextCursor"] is NSNull)
        let links = try await call(core, "queryNotes", ["quickFilter": "links", "query": "example", "tags": ["工作"]])
        XCTAssertEqual((links["notes"] as? [[String: Any]])?.map { $0["id"] as? String }, [linked["id"] as? String])
        let untagged = try await call(core, "queryNotes", ["quickFilter": "untagged"])
        XCTAssertEqual(Set((untagged["notes"] as? [[String: Any]])!.compactMap { $0["id"] as? String }), Set([image["id"] as! String, code["id"] as! String]))
        await expectCode("CURSOR_QUERY_MISMATCH") { _ = try await self.call(core, "queryNotes", ["quickFilter": "links", "limit": 1, "cursor": cursor]) }
        _ = try await save(core, id: linked["id"] as! String, body: "#工作 移除图片和链接", hash: linked["contentHash"] as? String)
        let updated = try await call(core, "queryNotes", ["quickFilter": "links"])
        XCTAssertEqual(updated["filterCounts"] as? [String: Int], ["untagged": 2, "images": 1, "links": 0])
    }

    func testInlineTagGrammarExcludesMarkdownSyntax() {
        XCTAssertEqual(inlineTags("#Work #work #WORK/Design #work/design"), ["work", "work/design"])
        XCTAssertEqual(inlineTags("# 标题\n正文 #工作/项目 #设计 #123 #/bad #bad/ #a//b C#"), ["工作/项目", "设计"])
        XCTAssertEqual(inlineTags("`#code`\n```md\n#fenced\n```\n    #indented\n[链接](#anchor) [#label](url) [[#wiki]] <span title=\"#html\">x</span> $x #math$\n#保留"), ["保留"])
        XCTAssertEqual(inlineTags("```\n#unfinished"), [])
    }

    func testTagCaseMergesSourcesCountsAndFiltersWithoutRewritingBody() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        let body = "#Work #work #WORK/Design"
        let url = try writeNote(id: id, body: body)
        let source = try String(contentsOf: url, encoding: .utf8).replacingOccurrences(of: "tags: [\"work\", \"ideas\"]", with: "tags: [WORK, work]")
        try Data(source.utf8).write(to: url)
        let before = try Data(contentsOf: url)
        let note = try await call(core, "getNote", ["id": id])
        XCTAssertEqual(note["tags"] as? [String], ["work", "work/design"])
        for tag in ["Work", "WORK", "work"] {
            let page = try await call(core, "queryNotes", ["tags": [tag]])
            XCTAssertEqual((page["notes"] as? [[String: Any]])?.count, 1)
        }
        let listed = try await call(core, "listTags")
        XCTAssertEqual((listed["tags"] as? [[String: Any]])?.first { $0["name"] as? String == "work" }?["count"] as? Int, 1)
        XCTAssertEqual(try Data(contentsOf: url), before)
        let saved = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "tags", "type": "list", "value": ["#AI", "ai", "Ai"]])
        XCTAssertEqual(saved["tags"] as? [String], ["ai", "work", "work/design"])
        XCTAssertEqual(saved["body"] as? String, body)
    }

    func testFilenameTitleAndEmptyPageLifecycle() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        var note = try await call(core, "saveNote", ["id": id, "title": "", "body": "# 正文标题\n\n正文", "tags": [], "baseHash": NSNull()])
        XCTAssertEqual(note["title"] as? String, "新内容")
        XCTAssertEqual(note["relativePath"] as? String, "notes/新内容.md")
        let duplicate = try await save(core, body: "另一条正文")
        XCTAssertEqual(duplicate["title"] as? String, "新内容 (2)")
        let editedDuplicate = try await call(core, "saveNote", ["id": duplicate["id"]!, "title": duplicate["title"]!, "body": "继续写另一条正文", "tags": [], "baseHash": duplicate["contentHash"]!])
        XCTAssertEqual(editedDuplicate["relativePath"] as? String, "notes/新内容 (2).md")
        note = try await save(core, id: id, body: "修改正文", hash: note["contentHash"] as? String)
        XCTAssertEqual(note["title"] as? String, "新内容")
        XCTAssertEqual(note["relativePath"] as? String, "notes/新内容.md")
        for (title, body) in [("只有标题", ""), ("", "只有正文"), ("", "")] {
            note = try await call(core, "saveNote", ["id": id, "title": title, "body": body, "tags": [], "baseHash": note["contentHash"]!])
            XCTAssertEqual(note["title"] as? String, title.isEmpty ? "新内容" : title)
            XCTAssertEqual(note["body"] as? String, body)
            XCTAssertEqual(note["relativePath"] as? String, "notes/\(title.isEmpty ? "新内容" : title).md")
            let reopened = try await call(core, "getNote", ["id": id])
            XCTAssertEqual(reopened["title"] as? String, title.isEmpty ? "新内容" : title)
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
        let saved = try await save(core, body: "#工作 #工作/项目/设计 #工作/项目/开发")
        _ = try await save(core, body: "#工作室")
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

    func testPropertyTagsSurviveIndependentBodyEditingAndRecovery() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        let url = try writeNote(id: id, body: "#工作/项目\n\n句中 #工作/项目\n\n#生活")
        let original = try Data(contentsOf: url)
        let note = try await call(core, "getNote", ["id": id])
        XCTAssertEqual(note["tags"] as? [String], ["work", "ideas", "工作/项目", "生活"])
        XCTAssertEqual(try Data(contentsOf: url), original)
        let old = try await call(core, "queryNotes", ["tags": ["work"]])
        XCTAssertEqual((old["notes"] as? [Any])?.count, 1)
        let draft = try await call(core, "saveDraft", ["id": id, "body": "正文 #生活", "tags": ["work"], "baseHash": note["contentHash"]!])
        XCTAssertEqual(draft["tags"] as? [String], ["生活"])
        let saved = try await save(core, id: id, body: "正文 #生活", tags: ["work"], hash: note["contentHash"] as? String)
        XCTAssertEqual(saved["tags"] as? [String], ["work", "ideas", "生活"])
        let cleared = try await save(core, id: id, body: "正文", tags: ["work"], hash: saved["contentHash"] as? String)
        XCTAssertEqual(cleared["tags"] as? [String], ["work", "ideas"])
        let listed = try await call(core, "listTags")
        XCTAssertEqual((listed["tags"] as? [Any])?.count, 2)
        let reopened = try await store(create: false)
        let fetched = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual(fetched["tags"] as? [String], ["work", "ideas"])
    }

    func testWarmLocalScanDetectsSameSizeEditsWithRestoredMtimeAndFileReplacement() async throws {
        for shared in [false, true] {
            let core = try await store(create: !shared)
            let id = UUID().uuidString.lowercased()
            let file: URL
            if shared {
                file = vault.appendingPathComponent("Warm.md")
                try Data("Body One".utf8).write(to: file)
            } else { file = try writeNote(id: id, body: "Body One") }
            let page = try await call(core, "queryNotes")
            let note = (page["notes"] as! [[String: Any]]).first { ($0["relativePath"] as! String).hasSuffix(shared ? "Warm.md" : "\(id).md") }!
            let noteID = note["id"] as! String
            let before = await core.sourceReadCount
            _ = try await call(core, "getNote", ["id": noteID])
            _ = try await call(core, "getStatus")
            let warm = await core.sourceReadCount
            XCTAssertEqual(warm, before)
            let modified = try FileManager.default.attributesOfItem(atPath: file.path)[.modificationDate]!
            let original = try String(contentsOf: file, encoding: .utf8)
            let changed = original.replacingOccurrences(of: "Body One", with: "Body Two")
            try Data(changed.utf8).write(to: file)
            try FileManager.default.setAttributes([.modificationDate: modified], ofItemAtPath: file.path)
            let edited = try await call(core, "getNote", ["id": noteID])
            XCTAssertEqual(edited["body"] as? String, "Body Two")
            XCTAssertNotEqual(edited["contentHash"] as? String, note["contentHash"] as? String)
            let replaced = changed.replacingOccurrences(of: "Body Two", with: "Body New")
            try Data(replaced.utf8).write(to: file, options: .atomic)
            try FileManager.default.setAttributes([.modificationDate: modified], ofItemAtPath: file.path)
            let replacement = try await call(core, "getNote", ["id": noteID])
            XCTAssertEqual(replacement["body"] as? String, "Body New")
            await core.close()
            // The second iteration needs a fresh compatible vault.
            try FileManager.default.removeItem(at: vault)
            try FileManager.default.createDirectory(at: vault, withIntermediateDirectories: true)
        }
    }

    func testPropertyReadsUseOneScanAndReuseUnchangedPropertyParsing() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        let url = try writeNote(id: id, body: "Body", extra: "field: One\n")
        let before = await core.scanCount
        let initial = try await call(core, "getNoteProperties", ["id": id])
        let scans = await core.scanCount
        XCTAssertEqual(scans - before, 1)
        _ = try await call(core, "getNoteProperties")
        let misses = await core.propertyParseMissCount
        _ = try await call(core, "getNoteProperties", ["id": id])
        _ = try await call(core, "getNoteProperties")
        let warmMisses = await core.propertyParseMissCount
        XCTAssertEqual(warmMisses, misses)
        let source = try String(contentsOf: url, encoding: .utf8)
        try Data(source.replacingOccurrences(of: "field: One", with: "field: Two").utf8).write(to: url)
        let changed = try await call(core, "getNoteProperties", ["id": id])
        XCTAssertNotEqual(initial["contentHash"] as? String, changed["contentHash"] as? String)
        XCTAssertEqual((changed["properties"] as! [[String: Any]]).first { $0["name"] as? String == "field" }?["value"] as? String, "Two")
        _ = try await call(core, "getNoteProperties")
        let changedMisses = await core.propertyParseMissCount
        XCTAssertGreaterThan(changedMisses, warmMisses)
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
        _ = try writeNote(id: older, date: "2026-09-01T10:00:00Z", body: "Case (literal) #work #ideas")
        _ = try writeNote(id: newer, date: "2026-09-02T10:00:00Z", body: "CASE (literal) #work #ideas")
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
        let path = "notes/work/project/图片记录.md"
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
        let noteURL = restored.appendingPathComponent(saved["relativePath"] as! String)
        let before = try Data(contentsOf: noteURL)
        let input = try JSONSerialization.data(withJSONObject: ["id": id, "body": "Must not write", "tags": [], "baseHash": saved["contentHash"]!])
        for operation in ["createNote", "updateNote", "saveNote", "saveDraft", "importAttachment", "getStatus"] {
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
        XCTAssertEqual(saved["title"] as? String, "新内容")
        XCTAssertEqual(saved["relativePath"] as? String, "新内容.md")
        let duplicate = try await save(core, body: "另一条正文")
        XCTAssertEqual(duplicate["title"] as? String, "新内容 (2)")
        let editedDuplicate = try await call(core, "saveNote", ["id": duplicate["id"]!, "title": duplicate["title"]!, "body": "继续写另一条正文", "tags": [], "baseHash": duplicate["contentHash"]!])
        XCTAssertEqual(editedDuplicate["relativePath"] as? String, "新内容 (2).md")
        XCTAssertEqual(try String(contentsOf: vault.appendingPathComponent("新内容.md"), encoding: .utf8), "# 我的记录\n\n正文")
        let edited = try await save(core, id: id, body: "修改正文", hash: saved["contentHash"] as? String)
        XCTAssertEqual(edited["relativePath"] as? String, "新内容.md")
        let reopened = try await store(create: false)
        let fetched = try await call(reopened, "getNote", ["id": id])
        XCTAssertEqual(fetched["title"] as? String, "新内容")
        let renamed = try await call(reopened, "saveNote", ["id": id, "title": "手动标题", "body": "修改正文", "tags": [], "baseHash": fetched["contentHash"]!])
        XCTAssertEqual(renamed["relativePath"] as? String, "手动标题.md")
        let editedAgain = try await save(reopened, id: id, body: "再次修改正文", hash: renamed["contentHash"] as? String)
        XCTAssertEqual(editedAgain["title"] as? String, "手动标题")
        XCTAssertEqual(editedAgain["relativePath"] as? String, "手动标题.md")
        let url = vault.appendingPathComponent("Tags.md")
        try Data("---\r\n# header\r\ntags: [old]\r\ncustom: \"keep spelling\"\r\n---\r\nBody #inline".utf8).write(to: url)
        let page = try await call(core, "queryNotes")
        let note = try XCTUnwrap((page["notes"] as? [[String: Any]])?.first { $0["relativePath"] as? String == "Tags.md" })
        _ = try await save(core, id: note["id"] as! String, body: "Body #inline", tags: ["new", "inline"], hash: note["contentHash"] as? String)
        XCTAssertEqual(try String(contentsOf: url, encoding: .utf8), "---\r\n# header\r\ntags: [old]\r\ncustom: \"keep spelling\"\r\n---\r\nBody #inline")
    }
}

extension VaultStoreTests {
    func testTagsPropertyIsIndexedWithoutChangingClosingDelimiterOrBody() throws {
        let source = "---\ntags:\n- old\n---\nBody"
        let identity = FileIdentity(id: UUID().uuidString.lowercased(), path: "A.md", hash: "", createdAt: timestamp())
        let parsed = try parseObsidianNote(Data(source.utf8), relativePath: "A.md", vaultID: UUID().uuidString, identity: identity, modified: Date())
        XCTAssertEqual(parsed.note.tags, ["old"])
        let bytes = try encodedObsidianNote(parsed, body: "Body")
        XCTAssertEqual(String(data: bytes, encoding: .utf8), source)
    }
}

extension VaultStoreTests {
    func testRenameUpdatesReferencesPreservesPropertiesAndStableIdentity() async throws {
        let core = try await store(create: false)
        let original = "---\r\ntitle: independent\r\ncustom: keep\r\n---\r\n# Heading\n[[Old]]"
        try Data(original.utf8).write(to: vault.appendingPathComponent("Old.md"))
        try Data("occupied".utf8).write(to: vault.appendingPathComponent("New.md"))
        try Data("[[Old#Heading|alias]] [text](Old.md) `[[Old]]`".utf8).write(to: vault.appendingPathComponent("Ref.md"))
        let page = try await call(core, "queryNotes")
        let note = try XCTUnwrap((page["notes"] as? [[String: Any]])?.first { $0["title"] as? String == "Old" })
        let saved = try await call(core, "saveNote", ["id": note["id"]!, "title": "New", "body": note["body"]!, "tags": [], "baseHash": note["contentHash"]!])
        XCTAssertEqual(saved["relativePath"] as? String, "New (2).md")
        XCTAssertEqual(saved["title"] as? String, "New (2)")
        XCTAssertEqual(try String(contentsOf: vault.appendingPathComponent("New (2).md"), encoding: .utf8), original.replacingOccurrences(of: "[[Old]]", with: "[[New (2)]]"))
        XCTAssertEqual(try String(contentsOf: vault.appendingPathComponent("Ref.md"), encoding: .utf8), "[[New (2)#Heading|alias]] [text](New%20%282%29.md) `[[Old]]`")
        XCTAssertFalse(FileManager.default.fileExists(atPath: vault.appendingPathComponent("Old.md").path))
        let reopened = try await store(create: false)
        let reread = try await call(reopened, "getNote", ["id": note["id"]!])
        XCTAssertEqual(reread["relativePath"] as? String, "New (2).md")
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "saveNote", ["id": note["id"]!, "title": "Stale", "body": "stale", "tags": [], "baseHash": note["contentHash"]!]) }
    }

    func testInterruptedRenameRecoveryAndExternalEditProtection() async throws {
        let core = try await store()
        let note = try await save(core, body: "Original")
        let path = note["relativePath"] as! String, before = try Data(contentsOf: vault.appendingPathComponent(path))
        let journal = await core.identityURL.appendingPathExtension("rename.json")
        let changes: [[String: Any]] = [["path": "notes/New.md", "after": before.base64EncodedString()], ["path": path, "before": before.base64EncodedString()]]
        let encoded = try JSONSerialization.data(withJSONObject: ["root": vault.path, "changes": changes, "identities": []])
        try before.write(to: vault.appendingPathComponent("notes/New.md")); try encoded.write(to: journal)
        _ = try await call(core, "queryNotes")
        XCTAssertFalse(FileManager.default.fileExists(atPath: vault.appendingPathComponent("notes/New.md").path))
        XCTAssertEqual(try Data(contentsOf: vault.appendingPathComponent(path)), before)
        try Data("external".utf8).write(to: vault.appendingPathComponent("notes/New.md")); try encoded.write(to: journal)
        await expectCode("RENAME_RECOVERY_REQUIRED") { _ = try await self.call(core, "queryNotes") }
        XCTAssertEqual(try String(contentsOf: vault.appendingPathComponent("notes/New.md"), encoding: .utf8), "external")
        XCTAssertTrue(FileManager.default.fileExists(atPath: journal.path))
    }
}

extension VaultStoreTests {
    func testChoicePropertiesPersistOptionsColorsAndEmptyTypesAcrossBodySaveAndRename() async throws {
        let core = try await store()
        let id = UUID().uuidString.lowercased()
        _ = try writeNote(id: id, body: "Body #keep\n")
        var note = try await call(core, "getNote", ["id": id])
        let options = [["name": "设计", "color": "blue"], ["name": "AI Design", "color": "purple"]]
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "阶段", "type": "select", "value": "", "options": options, "create": true])
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "领域", "type": "multiSelect", "value": [String](), "options": options, "create": true])
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "阶段", "type": "select", "value": "设计"])
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "领域", "type": "multiSelect", "value": ["设计", "AI Design"]])
        await expectCode("HASH_CONFLICT") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": "stale", "name": "阶段", "type": "select", "value": "设计"]) }
        await expectCode("INVALID_PROPERTY") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "阶段", "type": "select", "value": "未知"]) }
        await expectCode("INVALID_PROPERTY") { _ = try await self.call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "领域", "type": "multiSelect", "value": ["设计", "设计"]]) }
        note = try await save(core, id: id, body: "Updated #keep\n", hash: note["contentHash"] as? String)
        note = try await call(core, "saveNote", ["id": id, "baseHash": note["contentHash"]!, "title": "Choice renamed", "body": "Updated #keep\n", "tags": []])
        var properties = try await call(core, "getNoteProperties", ["id": id])["properties"] as! [[String: Any]]
        XCTAssertEqual(properties.map { $0["type"] as! String }, ["select", "multiSelect"])
        XCTAssertEqual(properties[1]["value"] as? [String], ["设计", "AI Design"])
        XCTAssertEqual(properties[1]["options"] as? [[String: String]], options)
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "阶段", "type": "select", "value": ""])
        note = try await call(core, "updateNoteProperty", ["id": id, "baseHash": note["contentHash"]!, "name": "领域", "type": "multiSelect", "value": [String]()])
        let reopened = try await store(create: false)
        note = try await save(reopened, id: id, body: "Empty choices #keep\n", hash: note["contentHash"] as? String)
        properties = try await call(reopened, "getNoteProperties", ["id": id])["properties"] as! [[String: Any]]
        XCTAssertEqual(properties.map { $0["type"] as! String }, ["select", "multiSelect"])
        XCTAssertEqual(properties[0]["value"] as? String, "")
        XCTAssertEqual(properties[1]["value"] as? [String], [])
        XCTAssertEqual(properties[0]["options"] as? [[String: String]], options)
        let raw = try String(contentsOf: vault.appendingPathComponent(note["relativePath"] as! String), encoding: .utf8)
        XCTAssertTrue(raw.contains("memocard:choice="))
        XCTAssertTrue(raw.hasSuffix("Empty choices #keep\n"))
    }
    func testQuotedChoiceNamesDoNotBecomeYAMLSyntaxOrMetadata() throws {
        let name = "AI !important # memocard:choice=literal"
        let options = [["name": name, "color": "blue"]]
        let change = try JSONDecoder().decode(PropertyChange.self, from: JSONSerialization.data(withJSONObject: ["id": "id", "baseHash": "hash", "name": "choice", "type": "select", "value": name, "options": options, "create": true]))
        let data = try patchNoteProperty(Data("Body".utf8), change: change)
        let property = try readNoteProperties(data).properties[0]
        XCTAssertEqual(property.type, "select")
        XCTAssertTrue(property.editable)
        XCTAssertEqual(property.options?.first?.name, name)
    }
    func testChoiceMetadataRejectsCorruptionAndInvalidDefinitions() throws {
        let source = "---\nchoice: \"a\" # memocard:choice={bad}\n---\nBody"
        let properties = try readNoteProperties(Data(source.utf8))
        XCTAssertEqual(properties.properties[0].type, "unsupported")
        XCTAssertFalse(properties.properties[0].editable)
        for options in [[["name": "a", "color": "invalid"]], [["name": "a", "color": "blue"], ["name": "a", "color": "red"]]] {
            let change = try JSONDecoder().decode(PropertyChange.self, from: JSONSerialization.data(withJSONObject: ["id": "id", "baseHash": "hash", "name": "choice", "type": "select", "value": "", "options": options, "create": true]))
            XCTAssertThrowsError(try patchNoteProperty(Data("Body".utf8), change: change))
        }
    }
}

private actor IndexingTestGate {
    private var open = false
    private var skip: Int
    init(skip: Int = 0) { self.skip = skip }
    private var waiters: [CheckedContinuation<Void, Never>] = []
    func wait() async {
        if skip > 0 { skip -= 1; return }
        if open { return }
        await withCheckedContinuation { waiters.append($0) }
    }
    func release() {
        open = true
        for waiter in waiters { waiter.resume() }
        waiters.removeAll()
    }
}
