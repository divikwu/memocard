import XCTest
import ImageIO
import UniformTypeIdentifiers
@testable import MemoCardCore

final class VaultStoreTests: XCTestCase {
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
        let metadata = try JSONDecoder().decode(VaultMetadata.self, from: Data(contentsOf: vault.appendingPathComponent(".memocard/vault.json")))
        let scope = sha256(Data((vault.path + ":" + metadata.vaultId).utf8))
        let journal = local.appendingPathComponent("identities-\(scope).json.rename.json")
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
        let identity = try FileManager.default.contentsOfDirectory(at: local, includingPropertiesForKeys: nil).first { $0.lastPathComponent.hasPrefix("identities-") }
        // Legacy vaults do not persist identities, but journal scope uses the same root and vault id.
        let metadata = try JSONDecoder().decode(VaultMetadata.self, from: Data(contentsOf: vault.appendingPathComponent(".memocard/vault.json")))
        let scope = sha256(Data((vault.path + ":" + metadata.vaultId).utf8))
        let journal = identity?.appendingPathExtension("rename.json") ?? local.appendingPathComponent("identities-\(scope).json.rename.json")
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
