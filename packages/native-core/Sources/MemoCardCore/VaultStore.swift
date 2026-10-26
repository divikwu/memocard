import Foundation
import Darwin
import ImageIO
import UniformTypeIdentifiers
import Yams

/// File-backed M1 foundation. The host retains the picker security scope while this store is open.
public actor VaultStore {
    private let localDataURL: URL
    private let fm = FileManager.default
    private var root: URL?
    private var metadata: VaultMetadata?
    private var localScope: String?
    private var binding = UUID()
    private var compatible: Bool { metadata?.formatVersion == 2 }
    private var identities: [FileIdentity] = []
    private var refreshSnapshot: Snapshot?
    private var refreshSnapshotConsumers = Set<String>()
    private struct SourceStamp: Equatable {
        let device: dev_t
        let inode: ino_t
        let size: off_t
        let mode: mode_t
        let modifiedSeconds: Int
        let modifiedNanos: Int
        let changedSeconds: Int
        let changedNanos: Int

        static func supports(_ url: URL) -> Bool {
            var volume = statfs()
            guard statfs(url.path, &volume) == 0 else { return false }
            let filesystem = withUnsafeBytes(of: volume.f_fstypename) { String(cString: $0.bindMemory(to: CChar.self).baseAddress!) }
            // Other filesystems may have coarse clocks or cache remote attributes.
            return filesystem == "apfs" && volume.f_flags & UInt32(MNT_LOCAL) != 0
        }

        init?(_ url: URL, localAPFS: Bool) throws {
            guard localAPFS else { return nil }
            var value = stat()
            guard lstat(url.path, &value) == 0 else { throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno)) }
            device = value.st_dev; inode = value.st_ino; size = value.st_size; mode = value.st_mode
            modifiedSeconds = value.st_mtimespec.tv_sec; modifiedNanos = value.st_mtimespec.tv_nsec
            changedSeconds = value.st_ctimespec.tv_sec; changedNanos = value.st_ctimespec.tv_nsec
        }
    }
    private struct ParsedCacheEntry {
        let hash: String
        let vaultID: String
        let identityID: String?
        let createdAt: String?
        let modified: Date?
        let parsed: ParsedNote
        var sourceStamp: SourceStamp?
        var properties: [NoteProperty]?
        var quickFilters: Set<NoteQuickFilter>?
    }
    private struct DirectoryIndex {
        var stamp: SourceStamp
        var names: Set<String>
    }
    private var localIndex: (snapshot: Snapshot, directories: [String: DirectoryIndex])?
    private var initialScan: ScanState?
    private var sourceIndexTask: Task<Void, Never>?
    private var filterIndexTask: Task<Void, Never>?
    private var backgroundIndexStarted = false
    private var indexing: IndexingProgress?
    private var indexFailure: VaultError?
    // Tests can hold a phase boundary without depending on machine speed.
    var indexingCheckpoint: (@Sendable (String) async -> Void)?

    func setIndexingCheckpoint(_ checkpoint: (@Sendable (String) async -> Void)?) {
        indexingCheckpoint = checkpoint
    }

    private func cancelIndexing() {
        sourceIndexTask?.cancel(); filterIndexTask?.cancel()
        sourceIndexTask = nil; filterIndexTask = nil; initialScan = nil
        indexing = nil; indexFailure = nil; backgroundIndexStarted = false
    }

    private var parsedCache: [String: ParsedCacheEntry] = [:]
    var parseMissCount = 0
    var sourceReadCount = 0
    var scanCount = 0
    var propertyParseMissCount = 0

    public init(localDataURL: URL) throws {
        guard localDataURL.isFileURL else {
            throw VaultError(code: "INVALID_PATH", message: "本机数据目录必须是文件 URL。")
        }
        try FileManager.default.createDirectory(at: localDataURL, withIntermediateDirectories: true)
        self.localDataURL = localDataURL.standardizedFileURL.resolvingSymlinksInPath()
    }

    public func close() {
        cancelIndexing()
        localIndex = nil
        invalidateSnapshot()
        parsedCache.removeAll()
        parseMissCount = 0
        sourceReadCount = 0; scanCount = 0; propertyParseMissCount = 0
        binding = UUID()
        root = nil
        metadata = nil
        localScope = nil
    }

    public func invalidateSnapshot() {
        // File-presenter notifications invalidate the batch, not the verified local index.
        // The next operation reconciles clocks and topology before reusing any entry.
        clearRefreshSnapshot()
    }

    private func clearRefreshSnapshot() {
        refreshSnapshot = nil
        refreshSnapshotConsumers.removeAll()
    }

    /// The host can serve attachments without exposing a general filesystem read operation.
    public func asset(relativePath: String, expectedBinding: UUID? = nil) throws -> Data {
        try requireBinding(expectedBinding)
        let (root, _) = try active()
        let components = relativePath.split(separator: "/", omittingEmptySubsequences: false)
        guard !components.isEmpty, (compatible || (components.count >= 2 && components.first == "assets")),
              components.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." }),
              !relativePath.contains("\\"), !relativePath.contains("\0"),
              !components.contains(where: { $0.hasPrefix(".") }),
              ["png", "jpg", "jpeg", "webp", "gif", "heic", "heif"].contains((relativePath as NSString).pathExtension.lowercased()) else {
            throw VaultError(code: "PATH_NOT_ALLOWED", message: "只允许读取 assets 目录中的附件。")
        }
        let target = root.appendingPathComponent(relativePath)
        return try coordinateRead(target, inside: root) { url in
            guard try self.fileType(url) == .typeRegular else {
                throw VaultError(code: "PATH_NOT_ALLOWED", message: "附件必须是普通文件。")
            }
            guard try self.isAvailable(url) else {
                throw VaultError(code: "FILE_PENDING", message: "附件尚未下载。", retryable: true)
            }
            return try Data(contentsOf: url)
        }
    }

    public func open(url: URL, create: Bool, binding: UUID = UUID()) throws {
        cancelIndexing()
        localIndex = nil
        invalidateSnapshot()
        parsedCache.removeAll()
        parseMissCount = 0
        sourceReadCount = 0; scanCount = 0; propertyParseMissCount = 0
        self.binding = binding
        // A failed selection must not silently continue serving a previously selected vault.
        root = nil
        metadata = nil
        localScope = nil
        guard url.isFileURL else { throw VaultError(code: "INVALID_PATH", message: "请选择本机文件目录。") }
        let selected = url.standardizedFileURL
        guard try fileType(selected) == .typeDirectory else {
            throw VaultError(code: "INVALID_PATH", message: "笔记库必须是实际目录，不能是符号链接。")
        }
        let candidate = selected.resolvingSymlinksInPath()
        let manifest = candidate.appendingPathComponent(".memocard/vault.json")
        try validate(manifest, inside: candidate)
        if !fm.fileExists(atPath: manifest.path) {

            try coordinateWrite(candidate, inside: candidate) { coordinated in
                let contents = try self.fm.contentsOfDirectory(atPath: coordinated.path).filter { $0 != ".DS_Store" }
                guard !create || contents.isEmpty else {
                    throw VaultError(code: "VAULT_NOT_EMPTY", message: "请在空目录中创建笔记库。")
                }
                for name in [".memocard"] {
                    try self.fm.createDirectory(at: coordinated.appendingPathComponent(name), withIntermediateDirectories: true)
                }
                let value = VaultMetadata(formatVersion: 2, vaultId: UUID().uuidString.lowercased())
                try encode(value).write(to: coordinated.appendingPathComponent(".memocard/vault.json"), options: .atomic)
            }
        }
        let value = try readMetadata(at: candidate)
        for directory in value.formatVersion == 1 ? ["notes", "assets"] : [] {
            let path = candidate.appendingPathComponent(directory)
            try validate(path, inside: candidate)
            guard try fileType(path) == .typeDirectory else {
                throw VaultError(code: "INVALID_VAULT", message: "笔记库缺少 notes 或 assets 目录。")
            }
        }
        // Device-only data must never be placed inside the synchronized vault.
        guard !isInside(localDataURL, candidate), !isInside(candidate, localDataURL) else {
            throw VaultError(code: "INVALID_LOCAL_DATA", message: "本机草稿目录必须与同步笔记库分开。")
        }
        root = candidate
        metadata = value
        identities = []
        // Directory identity survives a same-volume move, but is not copied with vault.json.
        var info = stat()
        guard lstat(candidate.path, &info) == 0,
              let volume = try candidate.resourceValues(forKeys: [.volumeUUIDStringKey]).volumeUUIDString else {
            root = nil; metadata = nil
            throw VaultError(code: "INVALID_LOCAL_DATA", message: "无法确认笔记库目录身份，本机恢复记录未绑定。")
        }
        localScope = sha256(Data("\(value.vaultId):\(volume):\(info.st_ino):\(info.st_birthtimespec.tv_sec):\(info.st_birthtimespec.tv_nsec)".utf8))
        let oldScope = sha256(Data((candidate.path + ":" + value.vaultId).utf8))
        let oldIdentity = localDataURL.appendingPathComponent("identities-\(oldScope).json")
        do {
            for (old, next) in [(oldIdentity, identityURL), (oldIdentity.appendingPathExtension("rename.json"), renameJournalURL)] where fm.fileExists(atPath: old.path) && !fm.fileExists(atPath: next.path) {
                if old == oldIdentity {
                    try coordinateRead(old, inside: localDataURL) { bytes in
                        guard try self.fileType(bytes) == .typeRegular else { throw VaultError(code: "INVALID_LOCAL_DATA", message: "本机身份记录不是普通文件。") }
                        try Data(contentsOf: bytes).write(to: next, options: .withoutOverwriting)
                    }
                } else {
                    try coordinateWrite(old, inside: localDataURL, options: .forMoving) { try self.fm.moveItem(at: $0, to: next) }
                }
            }
        } catch { root = nil; metadata = nil; localScope = nil; throw error }
        try recoverRename()
        if compatible, fm.fileExists(atPath: identityURL.path) {
            do { identities = try JSONDecoder().decode([FileIdentity].self, from: Data(contentsOf: identityURL)) }
            catch { root = nil; metadata = nil; throw VaultError(code: "INVALID_LOCAL_DATA", message: "本机笔记身份记录无法读取，请保留草稿后恢复本机记录。") }
        }
    }

    public func perform(operation: String, params: Data, expectedBinding: UUID? = nil) async throws -> Data {
        do {
            try requireBinding(expectedBinding)
            if ["getTagPreferences", "setTagPreferences", "getNote", "createNote", "updateNote", "saveNote", "saveDraft", "deleteDraft", "deleteNote", "getTrash", "getTrashedNote", "restoreNote", "permanentlyDeleteNote", "importAttachment"].contains(operation) {
                struct Scope: Decodable { var vaultId: String?; var vaultBinding: UUID? }
                let scope = try decode(Scope.self, params)
                try requireBinding(scope.vaultBinding)
                if let vaultId = scope.vaultId, vaultId != (try active()).1.vaultId { throw VaultError(code: "VAULT_CHANGED", message: "笔记库已切换，请重新打开笔记。") }
            }
            let operationBinding = binding
            if let task = sourceIndexTask {
                var wait = ["createNote", "updateNote", "saveNote", "updateNoteProperty", "getNoteProperties", "resolveLink", "deleteNote", "restoreNote", "importAttachment"].contains(operation)
                if operation == "getNote", let id = (try? JSONSerialization.jsonObject(with: params)) as? [String: Any] {
                    let requestedID = id["id"] as? String
                    wait = initialScan?.result.notes.contains(where: { $0.note.id == requestedID }) != true
                        || (compatible && !identities.contains(where: { $0.id == requestedID }))
                }
                if wait {
                    if ["saveNote", "updateNoteProperty", "getNoteProperties"].contains(operation),
                       let input = (try? JSONSerialization.jsonObject(with: params)) as? [String: Any], input["deferWhileIndexing"] as? Bool == true {
                        throw VaultError(code: "INDEXING", message: "正在完成首次校验，内容已保留在本机草稿，校验后会自动保存。", retryable: true)
                    }
                    await indexingCheckpoint?("waiting")
                    await task.value
                    guard operationBinding == binding else { throw VaultError(code: "UNAUTHORIZED", message: "笔记库授权已变化，请重新连接。") }
                    if let indexFailure { throw indexFailure }
                }
            }
            // Source recovery must not block the independent device-only recovery store.
            if !["saveDraft", "getDrafts", "dismissDraftReminder", "deleteDraft"].contains(operation) { try recoverRename() }
            switch operation {
            case "getStatus":
                struct Request: Decodable { var background: Bool? }
                let request = try decode(Request.self, params)
                if request.background == true, root != nil, !backgroundIndexStarted {
                    try startBackgroundIndex()
                }
                return try getStatus()
            case "queryNotes": return try queryNotes(try decode(Query.self, params))
            case "getNote":
                struct Request: Decodable { let id: String }
                return try encode(getNote(id: try decode(Request.self, params).id))
            case "createNote":
                struct Request: Decodable { let id: String?; let title: String?; let body: String }
                let request = try decode(Request.self, params)
                clearRefreshSnapshot()
                return try encode(saveNote(SaveRequest(title: request.title, id: request.id ?? UUID().uuidString.lowercased(), body: request.body, tags: [], inheritedTags: nil, baseHash: nil, relativePath: nil)))
            case "updateNote":
                struct Request: Decodable { let id: String; let title: String?; let body: String; let baseHash: String }
                let request = try decode(Request.self, params)
                guard !request.baseHash.isEmpty else { throw VaultError(code: "INVALID_ARGUMENT", message: "修改笔记必须提供读取时的内容版本。") }
                clearRefreshSnapshot()
                return try encode(saveNote(SaveRequest(title: request.title, id: request.id, body: request.body, tags: [], inheritedTags: nil, baseHash: request.baseHash, relativePath: nil)))
            case "saveNote":
                clearRefreshSnapshot()
                return try encode(saveNote(try decode(SaveRequest.self, params)))
            case "getNoteProperties":
                struct Request: Decodable { let id: String? }
                let (root, _) = try active()
                guard let id = try decode(Request.self, params).id else {
                    let config = try readPropertyDefinitions(root)
                    let properties = try inheritedProperties(libraryProperties(scan()), stored: config.values)
                    return try encode(NoteProperties(properties: properties, tagProperty: NoteProperty(name: "tags", type: "list", value: .list([]), editable: false), contentHash: "", writable: false, definitionHash: config.hash))
                }
                let snapshot = try scan()
                let note = try getNote(id: id, snapshot: snapshot)
                let data = try coordinateRead(root.appendingPathComponent(note.relativePath), inside: root) { try self.readSource($0) }
                return try encode(effectiveNoteProperties(data, snapshot: snapshot, config: readPropertyDefinitions(root)))
            case "getPropertyLabels": return try encode(readPropertyLabels())
            case "getTagPreferences": return try encode(readTagPreferences())
            case "setTagPreferences":
                struct Request: Decodable { let pinned: [String]; let icons: [String: String]; let baseHash: String }
                let request = try decode(Request.self, params)
                return try encode(setTagPreferences(TagPreferences(pinned: request.pinned, icons: request.icons), baseHash: request.baseHash))
            case "getNotePins": return try encode(readNotePins())
            case "setNotePinned":
                struct Request: Decodable { let id: String; let pinned: Bool; let baseHash: String; let vaultId: String? }
                let request = try decode(Request.self, params)
                if let vaultId = request.vaultId, vaultId != (try active()).1.vaultId { throw VaultError(code: "VAULT_CHANGED", message: "笔记库已切换，请重新打开笔记。") }
                return try encode(setNotePinned(id: request.id, pinned: request.pinned, baseHash: request.baseHash))
            case "renamePropertyLabel":
                struct Request: Decodable { let key: String; let label: String; let baseHash: String }
                let request = try decode(Request.self, params)
                return try encode(renamePropertyLabel(key: request.key, label: request.label, baseHash: request.baseHash))
            case "updateNoteProperty":
                clearRefreshSnapshot()
                return try encode(updateNoteProperty(try decode(PropertyChange.self, params)))
            case "resolveLink":
                struct LinkRequest: Decodable { let target: String; let sourcePath: String; let wiki: Bool? }
                let link = try decode(LinkRequest.self, params)
                return try resolveLink(link.target, sourcePath: link.sourcePath, wiki: link.wiki == true)
            case "listFolders":
                let snapshot = try snapshot(for: "listFolders")
                struct Folders: Encodable { let folders: [String]; let coverage: Coverage }
                return try encode(Folders(folders: snapshot.folders.sorted(), coverage: snapshot.coverage))
            case "listTags": return try listTags()
            case "getTrash": return try getTrash()
            case "getTrashedNote":
                struct Request: Decodable { let trashKey: String }
                return try encode(readTrashedNote(try decode(Request.self, params).trashKey))
            case "restoreNote":
                struct Request: Decodable { let trashKey: String; let baseHash: String }
                let input = try decode(Request.self, params)
                return try encode(restoreNote(input.trashKey, baseHash: input.baseHash))
            case "permanentlyDeleteNote":
                struct Request: Decodable { let trashKey: String; let baseHash: String }
                let input = try decode(Request.self,params)
                return try permanentlyDeleteNote(input.trashKey,baseHash:input.baseHash)
            case "deleteNote":
                struct Request: Decodable { let id: String; let baseHash: String }
                let input = try decode(Request.self, params)
                return try deleteNote(id: input.id, baseHash: input.baseHash)
            case "saveDraft": return try saveDraft(try decode(SaveRequest.self, params))
            case "getDrafts": return try getDrafts()
            case "dismissDraftReminder", "deleteDraft":
                struct Request: Decodable { let id: String; let draftKey: String; let revision: String; let unscoped: Bool?; let scope: String? }
                let input = try decode(Request.self, params)
                let source = RecoverySource(draftKey: input.draftKey, revision: input.revision, unscoped: input.unscoped, scope: input.scope)
                return operation == "deleteDraft" ? try deleteDraft(id: input.id, source: source) : try dismissDraftReminder(id: input.id, source: source)
            case "importAttachment":
                invalidateSnapshot()
                struct Request: Decodable { let name: String; let base64: String; let noteId: String?; let notePath: String? }
                let request = try decode(Request.self, params)
                return try importAttachment(name: request.name, base64: request.base64, noteID: request.noteId, requestedPath: request.notePath)
            default: throw VaultError(code: "UNSUPPORTED_OPERATION", message: "M1 尚未实现此操作。")
            }
        } catch let error as VaultError { throw error }
        catch { throw VaultError(code: "IO_ERROR", message: "文件操作未完成，请检查目录权限和文件可用性。", retryable: true) }
    }

    // Validate inside the same actor turn as the operation: a queued request must not
    // write into a replacement vault, including restored directories with the same ID.
    private func requireBinding(_ expectedBinding: UUID?) throws {
        guard expectedBinding == nil || expectedBinding == binding else {
            throw VaultError(code: "UNAUTHORIZED", message: "笔记库授权已变化，请重新连接。")
        }
    }

    private struct Snapshot {
        var folders: [String] = ["notes"]
        var notes: [ParsedNote] = []
        var duplicateIDs = Set<String>()
        var coverage = Coverage(complete: true, indexed: 0, pending: 0, issues: 0, indexedAt: nil)
    }

    private func seedRefreshSnapshot(_ snapshot: Snapshot) {
        refreshSnapshot = snapshot
        refreshSnapshotConsumers = ["queryNotes", "listTags", "listFolders"]
    }

    private func snapshot(for consumer: String) throws -> Snapshot {
        guard let snapshot = refreshSnapshot, refreshSnapshotConsumers.remove(consumer) != nil else {
            return try scan()
        }
        _ = try active()
        if refreshSnapshotConsumers.isEmpty { clearRefreshSnapshot() }
        return snapshot
    }

    private func active() throws -> (URL, VaultMetadata) {
        guard let root, let metadata else {
            throw VaultError(code: "VAULT_NOT_OPEN", message: "请先选择笔记库。")
        }
        guard try readMetadata(at: root).vaultId == metadata.vaultId else {
            throw VaultError(code: "VAULT_CHANGED", message: "所选目录的笔记库已变化，请重新选择。")
        }
        return (root, metadata)
    }

    private func readMetadata(at root: URL) throws -> VaultMetadata {
        let path = root.appendingPathComponent(".memocard/vault.json")
        let data = try coordinateRead(path, inside: root) { try Data(contentsOf: $0) }
        let metadata: VaultMetadata
        do { metadata = try JSONDecoder().decode(VaultMetadata.self, from: data) }
        catch { throw VaultError(code: "INVALID_VAULT", message: "无法解析笔记库元文件。") }
        guard metadata.formatVersion == 1 || metadata.formatVersion == 2 else {
            throw VaultError(code: "UNSUPPORTED_FORMAT", message: "当前应用不支持此笔记库格式。")
        }
        _ = try canonicalID(metadata.vaultId)
        return metadata
    }

    // Local APFS clocks and directory entries let us reconcile an existing index without
    // re-enumerating the vault. Every known source is still checked, including unrelated
    // notes, so corruption or duplicate IDs cannot silently bypass the write barrier.
    private func reconcileLocalIndex(root: URL, metadata: VaultMetadata) throws -> Snapshot? {
        guard var index = localIndex else { return nil }
        for (path, directory) in index.directories {
            let url = root.appendingPathComponent(path)
            guard let stamp = try SourceStamp(url, localAPFS: true), stamp.device == directory.stamp.device,
                  stamp.inode == directory.stamp.inode, stamp.mode == directory.stamp.mode else { return nil }
            if stamp != directory.stamp {
                let names = Set(try fm.contentsOfDirectory(atPath: url.path).filter { !$0.hasPrefix(".") })
                guard names == directory.names else { return nil }
                index.directories[path]?.stamp = stamp
            }
        }
        var changed = false
        for position in index.snapshot.notes.indices {
            let existing = index.snapshot.notes[position], path = existing.note.relativePath
            let url = root.appendingPathComponent(path)
            guard let cached = parsedCache[path], let old = cached.sourceStamp,
                  let stamp = try SourceStamp(url, localAPFS: true) else { return nil }
            if stamp == old { continue }
            let value: ParsedNote? = try coordinateRead(url, inside: root) { coordinated in
                try self.requireNoConflict(coordinated)
                let data = try self.readSource(coordinated)
                guard stamp == (try? SourceStamp(coordinated, localAPFS: true)) else { return nil }
                let identity = FileIdentity(id: existing.note.id, path: path, hash: sha256(data), createdAt: existing.note.createdAt)
                let modified = try coordinated.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate ?? Date(timeIntervalSince1970: 0)
                let parsed = try self.compatible ? parseObsidianNote(data, relativePath: path, vaultID: metadata.vaultId, identity: identity, modified: modified) : parseNote(data, relativePath: path, vaultID: metadata.vaultId)
                self.parseMissCount += 1
                self.parsedCache[path] = ParsedCacheEntry(hash: sha256(data), vaultID: metadata.vaultId,
                    identityID: self.compatible ? identity.id : nil, createdAt: self.compatible ? identity.createdAt : nil,
                    modified: self.compatible ? modified : nil, parsed: parsed, sourceStamp: stamp)
                return parsed
            }
            guard let value else { return nil }
            index.snapshot.notes[position] = value
            changed = true
        }
        guard Set(index.snapshot.notes.map { $0.note.id }).count == index.snapshot.notes.count else { return nil }
        // A directory changed during reconciliation: restart with a coordinated full scan.
        for (path, directory) in index.directories {
            guard directory.stamp == (try? SourceStamp(root.appendingPathComponent(path), localAPFS: true)) else { return nil }
        }
        if changed {
            index.snapshot.notes.sort { $0.createdDate == $1.createdDate ? $0.note.id < $1.note.id : $0.createdDate > $1.createdDate }
            if compatible {
                let byPath = Dictionary(uniqueKeysWithValues: index.snapshot.notes.map { ($0.note.relativePath, $0.note) })
                try persistIdentities(identities.map { previous in
                    guard let note = byPath[previous.path] else { return previous }
                    return FileIdentity(id: note.id, path: note.relativePath, hash: note.contentHash, createdAt: note.createdAt)
                })
            }
        }
        index.snapshot.coverage.indexedAt = timestamp()
        localIndex = index
        return index.snapshot
    }

    private func partialSnapshot(_ state: ScanState) -> Snapshot {
        var snapshot = state.result
        if compatible {
            let durableIDs = Set(identities.map(\.id))
            snapshot.notes.removeAll { !durableIDs.contains($0.note.id) }
        }
        let groups = Dictionary(grouping: snapshot.notes, by: { $0.note.id })
        snapshot.duplicateIDs = Set(groups.filter { $0.value.count > 1 }.map(\.key))
        snapshot.notes.removeAll { snapshot.duplicateIDs.contains($0.note.id) }
        snapshot.notes.sort { $0.createdDate == $1.createdDate ? $0.note.id < $1.note.id : $0.createdDate > $1.createdDate }
        snapshot.coverage.complete = false
        snapshot.coverage.indexed = snapshot.notes.count
        snapshot.coverage.issues += groups.filter { $0.value.count > 1 }.reduce(0) { $0 + $1.value.count }
        return snapshot
    }

    private func startBackgroundIndex() throws {
        let state = try beginScan(), expectedBinding = binding
        backgroundIndexStarted = true
        indexFailure = nil
        initialScan = state
        indexing = IndexingProgress(phase: "reading", processed: 0, total: nil)
        sourceIndexTask = Task { await self.readBackgroundIndex(state, expectedBinding: expectedBinding) }
    }

    private func readBackgroundIndex(_ state: ScanState, expectedBinding: UUID) async {
        do {
            while true {
                await indexingCheckpoint?("reading")
                guard !Task.isCancelled, expectedBinding == binding else { return }
                let done = try advanceScan(state, limit: 32)
                // Publish the first usable preview once. Rewriting all identities for
                // every read batch would turn startup into quadratic disk work.
                if !state.previewPublished && !state.unpublishedIdentities.isEmpty {
                    try persistIdentities(identities + state.unpublishedIdentities)
                    state.unpublishedIdentities.removeAll()
                    state.previewPublished = true
                }
                indexing?.processed = state.scannedPaths.count
                if done { break }
                try await Task.sleep(nanoseconds: 1_000_000)
            }
            while try !advanceIdentities(state, limit: 32) {
                try await Task.sleep(nanoseconds: 1_000_000)
                guard !Task.isCancelled, expectedBinding == binding else { return }
            }
            let snapshot = try finishScan(state)
            initialScan = nil
            clearRefreshSnapshot()
            sourceIndexTask = nil
            indexing = IndexingProgress(phase: "indexing", processed: 0, total: snapshot.notes.count)
            filterIndexTask = Task { await self.buildBackgroundFilters(expectedBinding: expectedBinding) }
        } catch {
            guard expectedBinding == binding, !Task.isCancelled else { return }
            initialScan = nil; sourceIndexTask = nil; indexing = nil
            backgroundIndexStarted = false
            indexFailure = error as? VaultError ?? VaultError(code: "SCAN_FAILED", message: "读取笔记库未完成，草稿仍保存在本机，请重试。", retryable: true)
            clearRefreshSnapshot()
        }
    }

    private func buildBackgroundFilters(expectedBinding: UUID) async {
        while true {
            var paths = parsedCache.compactMap { $0.value.quickFilters == nil ? $0.key : nil }
            if paths.isEmpty { break }
            while !paths.isEmpty {
                await indexingCheckpoint?("indexing")
                guard !Task.isCancelled, expectedBinding == binding else { return }
                let started = DispatchTime.now().uptimeNanoseconds
                var processed = 0
                while let path = paths.popLast() {
                    if let entry = parsedCache[path], entry.quickFilters == nil {
                        parsedCache[path]?.quickFilters = noteQuickFilters(entry.parsed.note)
                    }
                    processed += 1
                    if processed >= 32 || DispatchTime.now().uptimeNanoseconds - started >= 12_000_000 { break }
                }
                let nextProcessed = min(indexing?.total ?? 0, (indexing?.processed ?? 0) + processed)
                indexing?.processed = nextProcessed
                do { try await Task.sleep(nanoseconds: 1_000_000) } catch { return }
            }
        }
        guard !Task.isCancelled, expectedBinding == binding else { return }
        indexing = nil; filterIndexTask = nil
        clearRefreshSnapshot()
    }

    private final class ScanState {
        let root: URL
        let metadata: VaultMetadata
        let localAPFS: Bool
        let existingByPath: [String: FileIdentity]
        let allowEarlyNewIdentities: Bool
        var unpublishedIdentities: [FileIdentity] = []
        var previewPublished = false
        typealias Source = (path: String, data: Data?, modified: Date, hash: String, stamp: SourceStamp?)
        var identitiesPrepared = false
        var identityPosition = 0
        var missingByHash: [String: [FileIdentity]] = [:]
        var newByHash: [String: [Source]] = [:]
        var nextIdentities: [FileIdentity] = []
        var resolvedNotes: [ParsedNote] = []
        var earlyIdentities: [String: FileIdentity] = [:]
        var result = Snapshot()
        var sources: [(path: String, data: Data?, modified: Date, hash: String, stamp: SourceStamp?)] = []
        var scannedPaths = Set<String>()
        var observedPaths = Set<String>()
        var unavailableFolders = Set<String>()
        var enumerationFailed = false
        var directories: [String: DirectoryIndex] = [:]
        var enumerator: FileManager.DirectoryEnumerator?
        var deferredURL: URL?
        init(root: URL, metadata: VaultMetadata, localAPFS: Bool, identities: [FileIdentity]) {
            self.root = root; self.metadata = metadata; self.localAPFS = localAPFS
            allowEarlyNewIdentities = identities.isEmpty
            existingByPath = identities.reduce(into: [:]) { $0[$1.path] = $1 }
        }
        func nextURL() -> URL? {
            if let url = deferredURL { deferredURL = nil; return url }
            return enumerator?.nextObject() as? URL
        }
    }

    private func scan() throws -> Snapshot {
        if let state = initialScan { _ = try active(); return partialSnapshot(state) }
        let (root, metadata) = try active()
        let localAPFS = try SourceStamp.supports(root) && (root.resourceValues(forKeys: [.isUbiquitousItemKey]).isUbiquitousItem != true)
        if localAPFS, let snapshot = try? reconcileLocalIndex(root: root, metadata: metadata) { return snapshot }
        let state = try beginScan()
        while try !advanceScan(state, limit: Int.max) {}
        return try finishScan(state)
    }

    private func beginScan() throws -> ScanState {
        let (root, metadata) = try active()
        let localAPFS = try SourceStamp.supports(root) && (root.resourceValues(forKeys: [.isUbiquitousItemKey]).isUbiquitousItem != true)
        localIndex = nil
        scanCount += 1
        let notesURL = compatible ? root : root.appendingPathComponent("notes")
        try validate(notesURL, inside: root)
        guard try fileType(notesURL) == .typeDirectory else {
            throw VaultError(code: "VAULT_UNAVAILABLE", message: "笔记目录不可用。", retryable: true)
        }
        let state = ScanState(root: root, metadata: metadata, localAPFS: localAPFS, identities: identities)
        if compatible { state.result.folders = [""] }
        if let stamp = try SourceStamp(notesURL, localAPFS: localAPFS) {
            state.directories[relative(notesURL, root: root)] = DirectoryIndex(stamp: stamp, names: [])
        }
        state.enumerator = fm.enumerator(at: notesURL, includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles], errorHandler: { [weak state] url, _ in
                state?.enumerationFailed = true
                state?.unavailableFolders.insert(self.relative(url, root: root))
                return true
            })
        guard state.enumerator != nil else { throw VaultError(code: "SCAN_FAILED", message: "无法读取笔记目录。", retryable: true) }
        return state
    }

    private func advanceScan(_ state: ScanState, limit: Int) throws -> Bool {
        let root = state.root, metadata = state.metadata, localAPFS = state.localAPFS
        let localDevice = try SourceStamp(root, localAPFS: localAPFS)?.device
        let started = DispatchTime.now().uptimeNanoseconds
        var entries = 0
        while let url = state.nextURL() {
            defer { entries += 1 }
            if entries > 0 && (entries >= limit || DispatchTime.now().uptimeNanoseconds - started >= 12_000_000) {
                state.deferredURL = url
                return false
            }
            state.observedPaths.insert(relative(url, root: root))
            do {
                state.directories[relative(url.deletingLastPathComponent(), root: root)]?.names.insert(url.lastPathComponent)
                try validate(url, inside: root)
                let type = try fileType(url)
                if type == .typeDirectory {
                    let path = self.relative(url, root: root)
                    state.result.folders.append(path)
                    if let stamp = try SourceStamp(url, localAPFS: localAPFS), stamp.device == localDevice { state.directories[path] = DirectoryIndex(stamp: stamp, names: []) }
                    continue
                }
                guard type == .typeRegular else { state.result.coverage.issues += 1; continue }
                guard url.pathExtension.lowercased() == "md" else { continue }
                guard try isAvailable(url) else { state.result.coverage.pending += 1; continue }
                let path = relative(url, root: root)
                // Cloud versions still use coordination; local files must match identity and both clocks.
                let isCloud = try url.resourceValues(forKeys: [.isUbiquitousItemKey]).isUbiquitousItem == true
                let candidateStamp = isCloud ? nil : try SourceStamp(url, localAPFS: localAPFS)
                let stamp = candidateStamp?.device == localDevice ? candidateStamp : nil
                if let stamp, let cached = parsedCache[path], cached.vaultID == metadata.vaultId, cached.sourceStamp == stamp {
                    try requireNoConflict(url)
                    state.scannedPaths.insert(path)
                    if compatible, let modified = cached.modified {
                        state.sources.append((path, nil, modified, cached.hash, stamp))
                        state.result.notes.append(cached.parsed)
                    } else { state.result.notes.append(cached.parsed) }
                    continue
                }
                let parsed: ParsedNote? = try coordinateRead(url, inside: root) { coordinated in
                    try self.requireNoConflict(coordinated)
                    let data = try self.readSource(coordinated)
                    let path = self.relative(coordinated, root: root)
                    let hash = sha256(data)
                    let verifiedStamp = stamp != nil && stamp == (try? SourceStamp(coordinated, localAPFS: localAPFS)) ? stamp : nil
                    state.scannedPaths.insert(path)
                    if self.compatible {
                        let modified = try coordinated.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate ?? Date(timeIntervalSince1970: 0)
                        state.sources.append((path, data, modified, hash, verifiedStamp))
                        if let previous = state.existingByPath[path] ?? (state.allowEarlyNewIdentities ? FileIdentity(id: UUID().uuidString.lowercased(), path: path, hash: hash, createdAt: timestamp(modified)) : nil) {
                            state.earlyIdentities[path] = previous
                            let value = try parseObsidianNote(data, relativePath: path, vaultID: metadata.vaultId, identity: previous, modified: modified)
                            self.parseMissCount += 1
                            self.parsedCache[path] = ParsedCacheEntry(hash: hash, vaultID: metadata.vaultId, identityID: previous.id, createdAt: previous.createdAt, modified: modified, parsed: value, sourceStamp: verifiedStamp)
                            state.result.notes.append(value)
                            if !state.previewPublished && state.existingByPath[path] == nil { state.unpublishedIdentities.append(previous) }
                        }
                        return nil
                    }
                    if let cached = self.parsedCache[path], cached.hash == hash, cached.vaultID == metadata.vaultId,
                       cached.identityID == nil, cached.createdAt == nil, cached.modified == nil {
                        self.parsedCache[path]?.sourceStamp = verifiedStamp
                        return cached.parsed
                    }
                    let value = try parseNote(data, relativePath: path, vaultID: metadata.vaultId)
                    self.parseMissCount += 1
                    self.parsedCache[path] = ParsedCacheEntry(hash: hash, vaultID: metadata.vaultId,
                        identityID: nil, createdAt: nil, modified: nil, parsed: value, sourceStamp: verifiedStamp)
                    return value
                }
                if let parsed { state.result.notes.append(parsed) }
            } catch let error as VaultError where error.code == "FILE_PENDING" {
                state.result.coverage.pending += 1
            } catch {
                state.result.coverage.issues += 1
            }
        }
        state.enumerator = nil
        return true
    }

    private func advanceIdentities(_ state: ScanState, limit: Int) throws -> Bool {
        guard compatible else { return true }
        let root = state.root, metadata = state.metadata
        if !state.identitiesPrepared {
            state.identitiesPrepared = true
            let missing = identities.filter { item in
                guard !state.observedPaths.contains(item.path),
                      !state.unavailableFolders.contains(where: { $0.isEmpty || item.path == $0 || item.path.hasPrefix($0 + "/") }) else { return false }
                let url = root.appendingPathComponent(item.path)
                guard (try? validate(url, inside: root)) != nil else { return false }
                var info = stat()
                return lstat(url.path, &info) != 0 && errno == ENOENT
            }
            state.missingByHash = Dictionary(grouping: missing, by: \.hash)
            state.newByHash = Dictionary(grouping: state.sources.filter { state.existingByPath[$0.path] == nil }, by: \.hash)
        }
        let started = DispatchTime.now().uptimeNanoseconds
        var processed = 0
        while state.identityPosition < state.sources.count {
            let source = state.sources[state.identityPosition]
            state.identityPosition += 1
            defer { processed += 1 }
            let hash = source.hash
            let moved = state.missingByHash[hash] ?? []
            let candidates = state.newByHash[hash] ?? []
            let previous = state.existingByPath[source.path] ?? (moved.count == 1 && candidates.count == 1 ? moved.first : nil) ?? state.earlyIdentities[source.path]
            let identity = FileIdentity(id: previous?.id ?? UUID().uuidString.lowercased(), path: source.path, hash: hash, createdAt: previous?.createdAt ?? timestamp(source.modified))
            state.nextIdentities.append(identity)
            do {
                if let cached = parsedCache[source.path], cached.hash == hash, cached.vaultID == metadata.vaultId,
                   cached.identityID == identity.id, cached.createdAt == identity.createdAt, cached.modified == source.modified {
                    parsedCache[source.path]?.sourceStamp = source.stamp
                    state.resolvedNotes.append(cached.parsed)
                } else {
                    let data = try source.data ?? coordinateRead(root.appendingPathComponent(source.path), inside: root) { try self.readSource($0) }
                    let value = try parseObsidianNote(data, relativePath: source.path, vaultID: metadata.vaultId, identity: identity, modified: source.modified)
                    parseMissCount += 1
                    parsedCache[source.path] = ParsedCacheEntry(hash: hash, vaultID: metadata.vaultId,
                        identityID: identity.id, createdAt: identity.createdAt, modified: source.modified, parsed: value, sourceStamp: source.stamp)
                    state.resolvedNotes.append(value)
                }
            }
            catch { state.result.coverage.issues += 1 }
            if processed + 1 >= limit || DispatchTime.now().uptimeNanoseconds - started >= 12_000_000 { return false }
        }
        state.result.notes = state.resolvedNotes
        return true
    }

    private func finishScan(_ state: ScanState) throws -> Snapshot {
        let root = state.root, localAPFS = state.localAPFS
        if state.enumerationFailed { state.result.coverage.issues += 1 }
        while try !advanceIdentities(state, limit: Int.max) {}
        if compatible, !state.enumerationFailed, state.result.coverage.issues == 0, state.result.coverage.pending == 0 {
            try persistIdentities(state.nextIdentities)
        } else if compatible {
            // Partial coverage cannot retire or rebind unknown sources. Persist only
            // new readable identities so the notes already shown can still be opened.
            let knownIDs = Set(identities.map(\.id))
            let readableIDs = Set(state.resolvedNotes.map { $0.note.id })
            let additions = state.nextIdentities.filter { !knownIDs.contains($0.id) && readableIDs.contains($0.id) }
            if !additions.isEmpty { try persistIdentities(identities + additions) }
        }
        parsedCache = parsedCache.filter { state.scannedPaths.contains($0.key) }
        var result = state.result
        let groups = Dictionary(grouping: result.notes, by: { $0.note.id })
        for (id, notes) in groups where notes.count > 1 {
            result.duplicateIDs.insert(id)
            result.coverage.issues += notes.count
        }
        result.notes.removeAll { result.duplicateIDs.contains($0.note.id) }
        result.notes.sort {
            let left = $0.createdDate, right = $1.createdDate
            return left == right ? $0.note.id < $1.note.id : left > right
        }
        result.coverage.indexed = result.notes.count
        result.coverage.complete = result.coverage.pending == 0 && result.coverage.issues == 0
        result.coverage.indexedAt = timestamp()
        if localAPFS, result.coverage.complete, state.directories.count == Set(result.folders).count,
           result.notes.allSatisfy({ parsedCache[$0.note.relativePath]?.sourceStamp != nil }),
           state.directories.allSatisfy({ path, directory in directory.stamp == (try? SourceStamp(root.appendingPathComponent(path), localAPFS: true)) }) {
            localIndex = (result, state.directories)
        }
        return result
    }

    private func getStatus() throws -> Data {
        struct Status: Encodable {
            let connected: Bool
            let vaultId: String?
            let vaultName: String?
            let coverage: Coverage
            var indexing: IndexingProgress? = nil
            let phase: String
            let syncState: String
            let capabilities: [String]
            private enum CodingKeys: String, CodingKey { case connected, vaultId, vaultName, coverage, indexing, phase, syncState, capabilities }
            func encode(to encoder: Encoder) throws {
                var values = encoder.container(keyedBy: CodingKeys.self)
                try values.encode(connected, forKey: .connected)
                try values.encode(vaultId, forKey: .vaultId)
                try values.encode(vaultName, forKey: .vaultName)
                try values.encode(coverage, forKey: .coverage)
                try values.encodeIfPresent(indexing, forKey: .indexing)
                try values.encode(phase, forKey: .phase)
                try values.encode(syncState, forKey: .syncState)
                try values.encode(capabilities, forKey: .capabilities)
            }
        }
        let capabilities = ["getStatus", "queryNotes", "getNote", "saveNote", "getNoteProperties", "updateNoteProperty", "getPropertyLabels", "renamePropertyLabel", "getNotePins", "setNotePinned", "getTagPreferences", "setTagPreferences", "listTags", "listFolders", "resolveLink", "saveDraft", "getDrafts", "dismissDraftReminder", "deleteDraft", "deleteNote", "getTrash", "getTrashedNote", "restoreNote", "permanentlyDeleteNote", "importAttachment"]
        guard let root, let metadata else {
            return try encode(Status(connected: false, vaultId: nil, vaultName: nil,
                coverage: Coverage(complete: false, indexed: 0, pending: 0, issues: 0, indexedAt: nil),
                phase: "M1", syncState: "notConnected", capabilities: capabilities))
        }
        if let indexFailure { throw indexFailure }
        let snapshot = try scan()
        seedRefreshSnapshot(snapshot)
        let coverage = snapshot.coverage
        return try encode(Status(connected: true, vaultId: metadata.vaultId, vaultName: root.lastPathComponent,
            coverage: coverage, indexing: indexing, phase: "M1", syncState: coverage.complete ? "localReadComplete" : "incomplete",
            capabilities: capabilities))
    }

    private func queryNotes(_ query: Query) throws -> Data {
        let snapshot = try snapshot(for: "queryNotes")
        let sort = query.sort ?? "createdAt"
        guard ["createdAt", "updatedAt", "pinnedAt"].contains(sort) else { throw VaultError(code: "INVALID_PARAMS", message: "笔记排序无效。") }
        let pins = query.pinned != nil || sort == "pinnedAt" ? try readNotePins(snapshot: snapshot) : NotePins(pins: [:], contentHash: "")
        let sortDates = try Dictionary(uniqueKeysWithValues: snapshot.notes.map { parsed in
            (parsed.note.id, sort == "updatedAt" ? try parseDate(parsed.note.updatedAt) : sort == "pinnedAt" ? try parseDate(pins.pins[parsed.note.id] ?? parsed.note.createdAt) : parsed.createdDate)
        })
        let ordered = sort == "createdAt" ? snapshot.notes : snapshot.notes.sorted { sortDates[$0.note.id] == sortDates[$1.note.id] ? $0.note.id < $1.note.id : sortDates[$0.note.id]! > sortDates[$1.note.id]! }
        if let folder = query.folder, !folder.isEmpty {
            let parts = folder.split(separator: "/", omittingEmptySubsequences: false)
            guard (compatible || parts.first == "notes"), !parts.contains(where: { $0.isEmpty || $0 == "." || $0 == ".." }), !folder.contains("\\"), !folder.contains("\0") else {
                throw VaultError(code: "INVALID_PARAMS", message: "目录路径无效。")
            }
        }
        let from = try query.from.map(parseDate)
        let to = try query.to.map(parseDate)
        if let from, let to, from > to { throw VaultError(code: "INVALID_PARAMS", message: "开始时间不能晚于结束时间。") }
        let limit = query.limit ?? 50
        guard (1...100).contains(limit) else { throw VaultError(code: "INVALID_PARAMS", message: "limit 必须为 1 至 100。") }
        var fingerprintQuery = query
        fingerprintQuery.cursor = nil
        let queryHash = sha256(try encode(fingerprintQuery))
        // indexedAt changes on every scan and must not invalidate an unchanged snapshot.
        // Source hashes cover the whole Markdown; do not encode every body again to fingerprint a page.
        struct Fingerprint: Encodable { let id: String; let hash: String; let path: String; let source: String; let updatedAt: String? }
        let fingerprints = snapshot.notes.map {
            Fingerprint(id: $0.note.id, hash: $0.note.contentHash, path: $0.note.relativePath, source: $0.note.sourceUrl, updatedAt: sort == "updatedAt" ? $0.note.updatedAt : nil)
        }
        let snapshotHash = sha256(try encode(fingerprints) + Data("\(snapshot.coverage.pending):\(snapshot.coverage.issues):\(pins.contentHash)".utf8))
        var cursor: PageCursor?
        if let raw = query.cursor {
            guard let data = Data(base64Encoded: raw) else { throw VaultError(code: "INVALID_CURSOR", message: "分页游标无效。") }
            do { cursor = try JSONDecoder().decode(PageCursor.self, from: data) }
            catch { throw VaultError(code: "INVALID_CURSOR", message: "分页游标无效。") }
            _ = try parseDate(cursor!.createdAt)
            if let sortAt = cursor!.sortAt { _ = try parseDate(sortAt) }
            _ = try canonicalID(cursor!.id)
            guard cursor!.queryHash == queryHash else {
                throw VaultError(code: "CURSOR_QUERY_MISMATCH", message: "筛选条件已变化，请从第一页重新读取。")
            }
            guard cursor!.snapshotHash == snapshotHash else {
                throw VaultError(code: "STALE_CURSOR", message: "笔记库已变化，请从第一页重新读取。", retryable: true)
            }
        }
        let cursorDate = try cursor.map { try parseDate($0.sortAt ?? $0.createdAt) }
        let filters = Dictionary(uniqueKeysWithValues: snapshot.notes.map { parsed in
            let note = parsed.note
            let filters = parsedCache[note.relativePath]?.quickFilters ?? (indexing != nil ? (note.tags.isEmpty ? [.untagged] : []) : noteQuickFilters(note))
            if indexing == nil { parsedCache[note.relativePath]?.quickFilters = filters }
            return (note.id, filters)
        })
        var filterCounts = ["untagged": 0, "images": 0, "links": 0]
        for parsed in snapshot.notes where parsed.note.deletedAt == nil {
            for filter in filters[parsed.note.id]! { filterCounts[filter.rawValue, default: 0] += 1 }
        }
        let matches = ordered.filter { parsed in
            let note = parsed.note, date = sortDates[parsed.note.id]!
            if let pinned = query.pinned, (pins.pins[note.id] != nil) != pinned { return false }
            if sort == "pinnedAt", pins.pins[note.id] == nil { return false }
            if let folder = query.folder, !folder.isEmpty, !note.relativePath.hasPrefix(folder + "/") { return false }
            if (note.deletedAt != nil) != (query.deleted ?? false) { return false }
            if let filter = query.quickFilter, !filters[note.id]!.contains(filter) { return false }
            if let text = query.query, !text.isEmpty, ((note.title ?? "") + "\n" + note.body).range(of: text, options: [.caseInsensitive, .literal]) == nil { return false }
            if let tags = query.tags, !tags.allSatisfy({ value in let tag = tagKey(value); return note.tags.contains { $0 == tag || $0.hasPrefix(tag + "/") } }) { return false }
            if let from, parsed.createdDate < from { return false }
            if let to, parsed.createdDate >= to { return false }
            if let cursor, let cursorDate, !(date < cursorDate || (date == cursorDate && note.id > cursor.id)) { return false }
            return true
        }.map(\.note)
        // Limit actual JSON bytes as well as count. A single large legal note must still advance the cursor.
        let byteBudget = 2 * 1024 * 1024
        var notesData = Data("[".utf8)
        var page: [Note] = []
        for note in matches.prefix(limit) {
            let encoded = try encode(note)
            let separatorSize = page.isEmpty ? 0 : 1
            if !page.isEmpty, notesData.count + separatorSize + encoded.count + 1 > byteBudget { break }
            if !page.isEmpty { notesData.append(contentsOf: ",".utf8) }
            notesData.append(encoded)
            page.append(note)
            if notesData.count + 1 >= byteBudget { break }
        }
        notesData.append(contentsOf: "]".utf8)
        let next = matches.count > page.count ? try page.last.map {
            try encode(PageCursor(createdAt: $0.createdAt, id: $0.id, queryHash: queryHash, snapshotHash: snapshotHash, sortAt: sort == "updatedAt" ? $0.updatedAt : sort == "pinnedAt" ? pins.pins[$0.id] : nil)).base64EncodedString()
        } : nil
        // Reuse encoded notes instead of serializing potentially multi-megabyte bodies twice.
        var result = Data("{\"coverage\":".utf8)
        result.append(try encode(snapshot.coverage))
        result.append(contentsOf: ",\"filterCounts\":".utf8)
        result.append(try encode(filterCounts))
        result.append(contentsOf: ",\"nextCursor\":".utf8)
        result.append(try encode(next))
        result.append(contentsOf: ",\"notes\":".utf8)
        result.append(notesData)
        result.append(contentsOf: "}".utf8)
        return result
    }

    private func getNote(id: String) throws -> Note {
        try getNote(id: id, snapshot: scan())
    }

    private func getNote(id: String, snapshot: Snapshot) throws -> Note {
        let id = try canonicalID(id)
        if snapshot.duplicateIDs.contains(id) { throw VaultError(code: "DUPLICATE_ID", message: "多份文件使用同一个 ID，请先处理重复文件。") }
        guard let note = snapshot.notes.first(where: { $0.note.id == id })?.note else {
            throw VaultError(code: snapshot.coverage.complete ? "NOTE_NOT_FOUND" : "NOTE_UNAVAILABLE",
                             message: snapshot.coverage.complete ? "找不到此笔记。" : "部分文件尚不可读取，暂时无法确认此笔记。",
                             retryable: !snapshot.coverage.complete)
        }
        return note
    }

    private func newNotePath(_ value: String?, id: String, root: URL) throws -> String {
        let path = value ?? "\(compatible ? "" : "notes/")\(id).md"
        let parts = path.split(separator: "/", omittingEmptySubsequences: false)
        guard !parts.isEmpty, (compatible || (parts.count >= 2 && parts.first == "notes")), path.hasSuffix(".md"),
              parts.allSatisfy({ !$0.isEmpty && !$0.hasPrefix(".") }),
              !path.contains("\\"), !path.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) else {
            throw VaultError(code: "PATH_NOT_ALLOWED", message: "请选择笔记目录中的 Markdown 文件。")
        }
        let parent = root.appendingPathComponent(path).deletingLastPathComponent()
        try validate(parent, inside: root)
        guard fm.fileExists(atPath: parent.path), try fileType(parent) == .typeDirectory else {
            throw VaultError(code: "FOLDER_NOT_FOUND", message: "保存目录已移除，请保留草稿并重新选择目录。")
        }
        return path
    }

    private func saveNote(_ request: SaveRequest) throws -> Note {
        let id = try canonicalID(request.id)
        try validateDraftRequest(request, id: id)
        let tags = try validatedTags(inlineTags(request.body))
        let inheritedTags = try validatedTags(request.inheritedTags ?? [])
        let (root, metadata) = try active()
        let snapshot = try scan()
        if snapshot.duplicateIDs.contains(id) { throw VaultError(code: "DUPLICATE_ID", message: "笔记 ID 重复，无法覆盖保存。") }
        guard snapshot.coverage.complete else {
            throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库包含待下载、冲突或格式异常文件，可以先保存本机草稿，处理后再提交。", retryable: true)
        }
        let existing = snapshot.notes.first { $0.note.id == id }
        if existing?.note.deletedAt != nil { throw VaultError(code: "NOTE_DELETED", message: "此笔记已删除，无法编辑。") }
        var requestedPath = request.relativePath
        if existing == nil && request.baseHash == nil && (requestedPath == nil || requestedPath!.hasSuffix(id + ".md")) {
            requestedPath = namedNotePath(requestedPath ?? "\(compatible ? "" : "notes/")\(id).md", title: request.title ?? "", paths: snapshot.notes.map { $0.note.relativePath })
        }
        if let existing, let title = request.title, safeNoteTitle(title) != fileTitle(existing.note.relativePath) {
            let path = namedNotePath(existing.note.relativePath, title: title, paths: snapshot.notes.map { $0.note.relativePath })
            if path != existing.note.relativePath { return try renameNote(request, existing: existing, snapshot: snapshot, to: path, root: root, metadata: metadata) }
        }
        let target = try root.appendingPathComponent(existing?.note.relativePath ?? newNotePath(requestedPath, id: id, root: root))
        let config = existing == nil ? try readPropertyDefinitions(root) : nil
        let inherited = try config.map { try inheritedProperties(libraryProperties(snapshot), stored: $0.values) } ?? []
        let saved: Note
        do { saved = try coordinateWrite(target, inside: root) { coordinated in
            try self.requireNoConflict(coordinated)
            var frontmatter = Node([(Node, Node)]())
            var original: ParsedNote?
            var before: Data?
            if self.fm.fileExists(atPath: coordinated.path) {
                let data = try self.readSource(coordinated)
                before = data
                guard request.baseHash == sha256(data) else {
                    throw VaultError(code: "HASH_CONFLICT", message: "文件已在其他位置修改，原文未被覆盖。请保留草稿并重新读取。")
                }
                let parsed = try self.compatible ? parseObsidianNote(data, relativePath: self.relative(coordinated, root: root), vaultID: metadata.vaultId,
                    identity: FileIdentity(id: existing?.note.id ?? id, path: self.relative(coordinated, root: root), hash: sha256(data), createdAt: existing?.note.createdAt ?? timestamp()), modified: Date()) : parseNote(data, relativePath: self.relative(coordinated, root: root), vaultID: metadata.vaultId)
                original = parsed
                guard parsed.note.id == id else { throw VaultError(code: "HASH_CONFLICT", message: "目标文件身份已改变。") }
                guard parsed.note.deletedAt == nil else { throw VaultError(code: "NOTE_DELETED", message: "此笔记已删除，M1 不提供恢复编辑。") }
                frontmatter = parsed.frontmatter
            } else {
                guard request.baseHash == nil, existing == nil else {
                    throw VaultError(code: "NOTE_NOT_FOUND", message: "原文件已移除，不能从旧缓存恢复。")
                }
                frontmatter["id"] = Node(id, Tag(.str), .doubleQuoted)
                frontmatter["createdAt"] = Node(timestamp(), Tag(.str), .doubleQuoted)
            }
            frontmatter["updatedAt"] = Node(timestamp(), Tag(.str), .doubleQuoted)
            var data = try self.compatible ? encodedObsidianNote(original, body: request.body, title: request.title) : encodedNote(frontmatter: frontmatter, body: request.body, originalHeader: original?.originalHeader)
            for property in inherited {
                data = try patchNoteProperty(data, change: PropertyChange(id: id, baseHash: "", name: property.name, type: property.type, value: property.value, remove: nil, create: true, options: property.options))
            }
            if existing == nil && !inheritedTags.isEmpty {
                data = try patchNoteProperty(data, change: PropertyChange(id: id, baseHash: "", name: "tags", type: "list", value: .list(inheritedTags), remove: nil, create: nil))
            }
            if let config, try self.readPropertyDefinitions(root).hash != config.hash { throw VaultError(code: "HASH_CONFLICT", message: "属性定义已修改，请重新保存。") }
            guard data.count <= 8 * 1024 * 1024 else {
                throw VaultError(code: "NOTE_TOO_LARGE", message: "M1 单条 Markdown 最大支持 8 MiB。")
            }
            let identity = FileIdentity(id: id, path: self.relative(coordinated, root: root), hash: sha256(data), createdAt: existing?.note.createdAt ?? timestamp())
            let note = try self.compatible ? parseObsidianNote(data, relativePath: identity.path, vaultID: metadata.vaultId, identity: identity, modified: Date()).note : parseNote(data, relativePath: identity.path, vaultID: metadata.vaultId).note
            try self.writeSource(data, before: before, at: coordinated, identity: identity, root: root)
            return note
        } } catch { try recoverRename(); throw error }
        // Committing the source succeeds independently of best-effort draft cleanup.
        // A changed or unreadable draft must survive, never be discarded as "already saved".
        try? removeCommittedDraft(request, id: id, tags: tags)
        return saved
    }

    private struct TagPreferences: Codable, Equatable { var pinned: [String]; var icons: [String: String] }
    private struct TagPreferenceState: Encodable {
        let pinned: [String]; let icons: [String: String]; let contentHash: String; let initialized: Bool
    }
    private func validTagPreferences(_ value: TagPreferences) -> Bool {
        let tags = value.pinned + Array(value.icons.keys)
        return Set(value.pinned).count == value.pinned.count && tags.allSatisfy {
            !$0.isEmpty && $0 == tagKey($0) && $0 == $0.trimmingCharacters(in: .whitespacesAndNewlines)
                && !$0.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 })
        } && value.icons.values.allSatisfy { $0.utf16.count <= 32 && !$0.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) }
    }
    private func decodedTagPreferences(_ data: Data?) throws -> TagPreferenceState {
        do {
            let initialized = data?.isEmpty == false
            let value = initialized ? try JSONDecoder().decode(TagPreferences.self, from: data!) : TagPreferences(pinned: [], icons: [:])
            guard validTagPreferences(value) else { throw VaultError(code: "INVALID_TAG_PREFERENCES", message: "标签设置无效。") }
            return TagPreferenceState(pinned: value.pinned, icons: value.icons, contentHash: sha256(data ?? Data()), initialized: initialized)
        } catch { throw VaultError(code: "INVALID_TAG_PREFERENCES", message: "标签设置无法读取，请检查 .memocard/tag-preferences.json。") }
    }
    private func tagPreferenceData(_ url: URL) throws -> Data? {
        fm.fileExists(atPath: url.path) ? try readSource(url) : nil
    }
    private func readTagPreferences() throws -> TagPreferenceState {
        let (root, _) = try active()
        let path = root.appendingPathComponent(".memocard/tag-preferences.json")
        try validate(path, inside: root)
        if !fm.fileExists(atPath: path.path) { return try decodedTagPreferences(nil) }
        return try coordinateRead(path, inside: root) { try self.decodedTagPreferences(self.tagPreferenceData($0)) }
    }
    private func setTagPreferences(_ value: TagPreferences, baseHash: String) throws -> TagPreferenceState {
        guard validTagPreferences(value) else { throw VaultError(code: "INVALID_TAG_PREFERENCES", message: "标签设置无效。") }
        let (root, _) = try active()
        let path = root.appendingPathComponent(".memocard/tag-preferences.json")
        return try coordinateWrite(path, inside: root) { url in
            try self.requireNoConflict(url)
            let current = try self.decodedTagPreferences(self.tagPreferenceData(url))
            guard current.contentHash == baseHash else { throw VaultError(code: "HASH_CONFLICT", message: "标签设置已在其他位置修改，请重试。", retryable: true) }
            if current.initialized && current.pinned == value.pinned && current.icons == value.icons { return current }
            let data = try encode(value)
            try data.write(to: url, options: .atomic)
            return try self.decodedTagPreferences(data)
        }
    }

    private struct PropertyLabels: Encodable { let labels: [String: String]; let contentHash: String }
    private let systemPropertyLabels = ["system:tags": "标签", "system:updatedAt": "更新时间", "system:createdAt": "创建时间", "system:filename": "文件名"]
    private func defaultPropertyLabel(_ key: String) -> String { systemPropertyLabels[key] ?? String(key.dropFirst("property:".count)) }
    private func validPropertyLabel(_ value: String) -> Bool {
        !value.isEmpty && value.count <= 100 && value == value.trimmingCharacters(in: .whitespacesAndNewlines) && !value.unicodeScalars.contains { $0.value < 32 }
    }
    private func decodedNotePins(_ data: Data) throws -> NotePins {
        do {
            let pins = data.isEmpty ? [:] : try JSONDecoder().decode([String: String].self, from: data)
            for (id, date) in pins {
                if id.hasPrefix("path:") {
                    let path = String(id.dropFirst(5)), parts = path.split(separator: "/", omittingEmptySubsequences: false)
                    guard path.lowercased().hasSuffix(".md"), !parts.contains(where: { $0.isEmpty || $0.hasPrefix(".") }), !path.contains("\\"), !path.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) else { throw VaultError(code: "INVALID_PINS", message: "固定记录路径无效。") }
                } else if try canonicalID(id) != id { throw VaultError(code: "INVALID_PINS", message: "固定记录身份无效。") }
                _ = try parseDate(date)
            }
            return NotePins(pins: pins, contentHash: sha256(data))
        } catch { throw VaultError(code: "INVALID_PINS", message: "固定记录无法读取，请检查 .memocard/pins.json。") }
    }

    private func resolvedNotePins(_ stored: NotePins, snapshot: Snapshot) -> NotePins {
        let pins = Dictionary(uniqueKeysWithValues: snapshot.notes.compactMap { item -> (String, String)? in
            guard item.note.deletedAt == nil, let date = stored.pins[compatible ? "path:" + item.note.relativePath : item.note.id] else { return nil }
            return (item.note.id, date)
        })
        return NotePins(pins: pins, contentHash: stored.contentHash)
    }

    private func readStoredNotePins() throws -> NotePins {
        let (root, _) = try active()
        let path = root.appendingPathComponent(".memocard/pins.json")
        try validate(path, inside: root)
        if !fm.fileExists(atPath: path.path) { return try decodedNotePins(Data()) }
        return try coordinateRead(path, inside: root) { try self.decodedNotePins(self.readSource($0)) }
    }

    private func readNotePins(snapshot: Snapshot? = nil) throws -> NotePins {
        let stored = try readStoredNotePins()
        if stored.pins.isEmpty { return stored }
        return try resolvedNotePins(stored, snapshot: snapshot ?? scan())
    }

    private func setNotePinned(id: String, pinned: Bool, baseHash: String) throws -> NotePins {
        let id = try canonicalID(id)
        let snapshot = try scan()
        guard snapshot.coverage.complete else { throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库尚未完整读取，暂时无法修改固定状态。") }
        let note = try getNote(id: id, snapshot: snapshot)
        guard note.deletedAt == nil else { throw VaultError(code: "NOTE_NOT_FOUND", message: "找不到此笔记。") }
        let key = compatible ? "path:" + note.relativePath : id
        let (root, _) = try active()
        let path = root.appendingPathComponent(".memocard/pins.json")
        return try coordinateWrite(path, inside: root) { url in
            try self.requireNoConflict(url)
            let data = self.fm.fileExists(atPath: url.path) ? try self.readSource(url) : Data()
            let current = try self.decodedNotePins(data)
            guard current.contentHash == baseHash else { throw VaultError(code: "HASH_CONFLICT", message: "固定状态已在其他位置修改，请重试。", retryable: true) }
            var pins = current.pins
            if pinned { if pins[key] == nil { pins[key] = timestamp() } }
            else { pins.removeValue(forKey: key) }
            if pins == current.pins { return self.resolvedNotePins(current, snapshot: snapshot) }
            let bytes = try encode(pins)
            try bytes.write(to: url, options: .atomic)
            return self.resolvedNotePins(NotePins(pins: pins, contentHash: sha256(bytes)), snapshot: snapshot)
        }
    }

    private func propertyLabelBytes(_ url: URL) throws -> Data {
        guard fm.fileExists(atPath: url.path) else { return Data() }
        return try readSource(url)
    }
    private func decodedPropertyLabels(_ data: Data) throws -> PropertyLabels {
        let labels: [String: String]
        do { labels = data.isEmpty ? [:] : try JSONDecoder().decode([String: String].self, from: data) }
        catch { throw VaultError(code: "INVALID_PROPERTY", message: "属性名称配置无法读取，请检查 .memocard/property-labels.json。") }
        guard labels.allSatisfy({ (systemPropertyLabels[$0.key] != nil || $0.key.hasPrefix("property:") && $0.key.count > 9) && validPropertyLabel($0.value) }) else {
            throw VaultError(code: "INVALID_PROPERTY", message: "属性名称配置无法读取，请检查 .memocard/property-labels.json。")
        }
        return PropertyLabels(labels: labels, contentHash: sha256(data))
    }
    private func readPropertyLabels() throws -> PropertyLabels {
        let (root, _) = try active()
        let path = root.appendingPathComponent(".memocard/property-labels.json")
        try validate(path, inside: root)
        if !fm.fileExists(atPath: path.path) { return try decodedPropertyLabels(Data()) }
        return try coordinateRead(path, inside: root) { try self.decodedPropertyLabels(self.propertyLabelBytes($0)) }
    }
    private func renamePropertyLabel(key: String, label: String, baseHash: String) throws -> PropertyLabels {
        let label = label.trimmingCharacters(in: .whitespacesAndNewlines)
        guard validPropertyLabel(label) else { throw VaultError(code: "INVALID_PROPERTY", message: "属性名不能为空、超过 100 字或包含控制字符。") }
        let snapshot = try scan()
        guard snapshot.coverage.complete else { throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库尚未完整读取，无法安全修改属性名称。") }
        let (root, _) = try active()
        var keys = Set(systemPropertyLabels.keys)
        for item in snapshot.notes {
            let data = try coordinateRead(root.appendingPathComponent(item.note.relativePath), inside: root) { try self.readSource($0) }
            for property in try readNoteProperties(data).properties { keys.insert("property:" + property.name) }
        }
        guard keys.contains(key) else { throw VaultError(code: "INVALID_PROPERTY", message: "属性已被移除，请重新加载。") }
        let path = root.appendingPathComponent(".memocard/property-labels.json")
        return try coordinateWrite(path, inside: root) { url in
            try self.requireNoConflict(url)
            let current = try self.decodedPropertyLabels(self.propertyLabelBytes(url))
            guard current.contentHash == baseHash else { throw VaultError(code: "HASH_CONFLICT", message: "属性名称已在其他位置修改，请重新打开后重试。") }
            guard !keys.union(current.labels.keys).contains(where: { $0 != key && (current.labels[$0] ?? self.defaultPropertyLabel($0)) == label }) else { throw VaultError(code: "INVALID_PROPERTY", message: "属性名称已存在。") }
            var labels = current.labels
            if label == self.defaultPropertyLabel(key) { labels.removeValue(forKey: key) } else { labels[key] = label }
            let data = try encode(labels)
            try data.write(to: url, options: .atomic)
            return PropertyLabels(labels: labels, contentHash: sha256(data))
        }
    }

    private func readPropertyDefinitions(_ root: URL) throws -> (before: Data?, values: [String: PropertyDefinition], hash: String) {
        let path = root.appendingPathComponent(propertyDefinitionPath)
        try validate(path, inside: root)
        let data = fm.fileExists(atPath: path.path) ? try coordinateRead(path, inside: root) { try self.readSource($0) } : nil
        let values: [String: PropertyDefinition]
        do { values = data == nil || data!.isEmpty ? [:] : try JSONDecoder().decode([String: PropertyDefinition].self, from: data!) }
        catch { throw VaultError(code: "INVALID_PROPERTY", message: "属性定义配置无法读取，请检查 .memocard/property-definitions.json。") }
        guard values.allSatisfy({ !$0.key.isEmpty && !["id", "createdAt", "updatedAt", "deletedAt", "tags"].contains($0.key) && validPropertyDefinition($0.value) }) else {
            throw VaultError(code: "INVALID_PROPERTY", message: "属性定义配置无法读取，请检查 .memocard/property-definitions.json。")
        }
        return (data, values, sha256(data ?? Data()))
    }
    private func libraryProperties(_ snapshot: Snapshot) throws -> [NoteProperty] {
        try snapshot.notes.filter { $0.note.deletedAt == nil }.sorted { $0.note.relativePath < $1.note.relativePath }.flatMap { item in
            if let cached = parsedCache[item.note.relativePath], cached.hash == item.note.contentHash, let properties = cached.properties { return properties }
            // The snapshot already verified the source hash. Only YAML is needed for library options.
            let properties = try readNoteProperties(Data((item.originalHeader ?? "").utf8)).properties
            propertyParseMissCount += 1
            if parsedCache[item.note.relativePath]?.hash == item.note.contentHash { parsedCache[item.note.relativePath]?.properties = properties }
            return properties
        }
    }
    private func effectiveNoteProperties(_ data: Data, snapshot: Snapshot, config: (before: Data?, values: [String: PropertyDefinition], hash: String)) throws -> NoteProperties {
        let raw = try readNoteProperties(data)
        let all = try libraryProperties(snapshot).map(listAsMultiSelect)
        var properties = raw.properties.map { property -> NoteProperty in
            guard property.type != "unsupported" else { return property }
            let property = listAsMultiSelect(property)
            if let definition = config.values[property.name] { return convertedProperty(property, definition: resolvedPropertyDefinition(definition, properties: all.filter { $0.name == property.name })) }
            guard property.options != nil else { return property }
            return NoteProperty(name: property.name, type: property.type, value: property.value, editable: property.editable, options: mergedPropertyOptions(all.filter { $0.name == property.name }))
        }
        let names = Set(properties.map(\.name))
        properties += try inheritedProperties(all, stored: config.values).filter { !names.contains($0.name) }.map {
            NoteProperty(name: $0.name, type: $0.type, value: $0.value, editable: raw.writable, options: $0.options)
        }
        return NoteProperties(properties: properties, tagProperty: raw.tagProperty, contentHash: raw.contentHash, writable: raw.writable, definitionHash: config.hash)
    }
    private func updatePropertyDefinition(_ change: PropertyChange, snapshot: Snapshot, existing: ParsedNote, root: URL, metadata: VaultMetadata) throws -> PropertyUpdateResult {
        let config = try readPropertyDefinitions(root)
        guard change.definitionHash == nil || change.definitionHash == config.hash else { throw VaultError(code: "HASH_CONFLICT", message: "属性定义已在其他位置修改，请重新打开后重试。") }
        let original = try readSource(root.appendingPathComponent(existing.note.relativePath))
        guard sha256(original) == change.baseHash else { throw VaultError(code: "HASH_CONFLICT", message: "笔记已在其他位置修改，库级属性未更新。") }
        let removing = change.remove == true
        guard let current = try effectiveNoteProperties(original, snapshot: snapshot, config: config).properties.first(where: { $0.name == change.name }), current.editable, change.create != true, change.renameTo == nil, change.copyFrom == nil, removing || change.type != nil else { throw VaultError(code: "INVALID_PROPERTY", message: "只有可编辑的自定义属性支持修改库级定义。") }
        let type = change.type ?? current.type
        let properties = try libraryProperties(snapshot).filter { $0.name == change.name }.map(listAsMultiSelect)
        guard properties.allSatisfy({ $0.editable }) else { throw VaultError(code: "INVALID_PROPERTY", message: "此属性包含只读值，库级修改未保存。") }
        let typeChanged = (config.values[change.name].map { resolvedPropertyDefinition($0, properties: properties).type } ?? current.type) != type
        let definition = newPropertyDefinition(properties, type: type, options: change.options, includeValues: typeChanged)
        let previousDefinition = config.values[change.name].map { resolvedPropertyDefinition($0, properties: properties) }
        let previousOptions = mergedPropertyOptions(properties)
        guard removing || validPropertyDefinition(definition) else { throw VaultError(code: "INVALID_PROPERTY", message: "属性类型或选项定义无效，最多支持 200 个选项。") }
        if !removing, let rename = change.optionRename {
            let previous = config.values[change.name]?.options ?? mergedPropertyOptions(properties)
            guard !typeChanged, previous.contains(where: { $0.name == rename.from }), !previous.contains(where: { $0.name == rename.to }), definition.options?.contains(where: { $0.name == rename.to }) == true, definition.options?.contains(where: { $0.name == rename.from }) == false else { throw VaultError(code: "INVALID_PROPERTY", message: "选项重命名无效。") }
        }
        var changes: [RenameChange] = []
        var saved = existing.note
        var updatedSnapshot = snapshot
        var savedData = original
        for (index, item) in snapshot.notes.enumerated() where item.note.deletedAt == nil {
            if removing, let cached = parsedCache[item.note.relativePath], cached.hash == item.note.contentHash, let fields = cached.properties, !fields.contains(where: { $0.name == change.name }) { continue }
            let before = try coordinateRead(root.appendingPathComponent(item.note.relativePath), inside: root) { try self.readSource($0) }
            guard sha256(before) == item.note.contentHash else { throw VaultError(code: "HASH_CONFLICT", message: "笔记已在其他位置修改，库级属性未更新。") }
            let raw = try readNoteProperties(before)
            let stored = raw.properties.first(where: { $0.name == change.name })
            // Missing fields stay virtual unless this edit supplies a value for the current note.
            let hasValue = change.value.map { value in
                switch value { case .text(let text): return !text.isEmpty; case .list(let list): return !list.isEmpty; case .checkbox(let checked): return checked }
            } ?? false
            guard let property = stored ?? (!removing && item.note.id == existing.note.id && hasValue ? current : nil) else { continue }
            guard property.editable else { throw VaultError(code: "INVALID_PROPERTY", message: "「\(item.note.relativePath)」的此属性只读，库级修改未保存。") }
            let normalized = listAsMultiSelect(property)
            let effective = previousDefinition.map { convertedProperty(normalized, definition: $0) } ?? NoteProperty(name: normalized.name, type: normalized.type, value: normalized.value, editable: normalized.editable, options: normalized.options == nil ? nil : previousOptions)
            let converted = removing ? property : convertedProperty(effective, definition: definition, rename: change.optionRename, pruneOptions: !typeChanged)
            if !removing && (typeChanged || normalized.type != definition.type) && !losslessPropertyConversion(normalized, converted) {
                throw VaultError(code: "LOSSY_PROPERTY_CONVERSION", message: "「\(item.note.relativePath)」的「\(change.name)」无法无损转换。笔记库未修改，请先保留或调整原值。")
            }
            let value = item.note.id == existing.note.id && !typeChanged ? change.value ?? converted.value : converted.value
            let update = PropertyChange(id: item.note.id, baseHash: item.note.contentHash, name: change.name, type: definition.type, value: value, remove: removing ? true : nil, create: stored == nil ? true : nil, options: definition.options)
            var retainedValues: [String]?
            if let rename = change.optionRename, case .list(let values) = property.value { retainedValues = values.map { $0 == rename.from ? rename.to : $0 } }
            let after = try patchNoteProperty(before, change: update, updatedAt: compatible ? nil : timestamp(), retainedValues: retainedValues)
            guard after.count <= 8 * 1024 * 1024 else { throw VaultError(code: "NOTE_TOO_LARGE", message: "单条 Markdown 最大支持 8 MiB。") }
            let identity = FileIdentity(id: item.note.id, path: item.note.relativePath, hash: sha256(after), createdAt: item.note.createdAt)
            let parsed = try compatible ? parseObsidianNote(after, relativePath: identity.path, vaultID: metadata.vaultId, identity: identity, modified: Date()) : parseNote(after, relativePath: identity.path, vaultID: metadata.vaultId)
            changes.append(RenameChange(path: identity.path, before: before, after: after))
            updatedSnapshot.notes[index] = parsed
            if item.note.id == existing.note.id { saved = parsed.note; savedData = after }
        }
        var definitions = config.values
        if removing { definitions.removeValue(forKey: change.name) }
        else { definitions[change.name] = definition }
        let definitionData = try encode(definitions)
        changes.append(RenameChange(path: propertyDefinitionPath, before: config.before, after: definitionData))
        let propertyData = try effectiveNoteProperties(savedData, snapshot: updatedSnapshot, config: (definitionData, definitions, sha256(definitionData)))
        let journal = RenameJournal(root: root.path, scope: localScope, changes: changes, identities: identities)
        do {
            try coordinateWrite(root, inside: root, options: .forMerging) { _ in
                try encode(journal).write(to: self.renameJournalURL, options: .atomic)
                for change in changes {
                    guard try self.renameBytes(change.path, root: root) == change.before else { throw VaultError(code: "HASH_CONFLICT", message: "批量修改期间文件已改变，备份已保留。") }
                    let url = root.appendingPathComponent(change.path)
                    try self.requireNoConflict(url)
                    try change.after!.write(to: url, options: change.before == nil ? .withoutOverwriting : .atomic)
                }
                if self.compatible {
                    try self.persistIdentities(self.identities.map { item in
                        FileIdentity(id: item.id, path: item.path, hash: changes.first { $0.path == item.path }.map { sha256($0.after!) } ?? item.hash, createdAt: item.createdAt)
                    })
                }
                try self.fm.removeItem(at: self.renameJournalURL)
            }
        } catch { try recoverRename(); throw error }
        parsedCache.removeAll(); invalidateSnapshot()
        return PropertyUpdateResult(note: saved, propertyData: propertyData)
    }
    private func updateNoteProperty(_ change: PropertyChange) throws -> PropertyUpdateResult {
        let id = try canonicalID(change.id)
        let snapshot = try scan()
        guard snapshot.coverage.complete else { throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库尚未完整读取，无法安全修改属性。") }
        guard let existing = snapshot.notes.first(where: { $0.note.id == id }), existing.note.deletedAt == nil else { throw VaultError(code: "NOTE_NOT_FOUND", message: "找不到可编辑的笔记。") }
        let (root, metadata) = try active()
        if change.definition == true || change.remove == true { return try updatePropertyDefinition(change, snapshot: snapshot, existing: existing, root: root, metadata: metadata) }
        let config = try readPropertyDefinitions(root)
        guard change.definitionHash == nil || change.definitionHash == config.hash else { throw VaultError(code: "HASH_CONFLICT", message: "属性定义已在其他位置修改，请重新打开后重试。") }
        var adjusted = change
        if let stored = config.values[change.name], change.remove != true, change.renameTo == nil {
            let definition = resolvedPropertyDefinition(stored, properties: stored.type == "list" ? try libraryProperties(snapshot).filter { $0.name == change.name } : [])
            guard change.type == definition.type else { throw VaultError(code: "INVALID_PROPERTY", message: "属性类型已变化，请重新打开后编辑。") }
            if let options = change.options, !(change.create == true && options.isEmpty) {
                guard options.count == definition.options?.count, zip(options, definition.options ?? []).allSatisfy({ $0.name == $1.name && $0.color == $1.color }) else { throw VaultError(code: "INVALID_PROPERTY", message: "选项已变化，请重新打开后编辑。") }
            }
            adjusted.options = definition.options
        }
        do { return try coordinateWrite(root.appendingPathComponent(existing.note.relativePath), inside: root) { url in
            try self.requireNoConflict(url)
            let before = try self.readSource(url)
            guard sha256(before) == change.baseHash, try self.readPropertyDefinitions(root).before == config.before else { throw VaultError(code: "HASH_CONFLICT", message: "文件或属性定义已修改，请重新加载。") }
            let raw = try readNoteProperties(before)
            let effective = try self.effectiveNoteProperties(before, snapshot: snapshot, config: config)
            if let copyFrom = adjusted.copyFrom, !raw.properties.contains(where: { $0.name == copyFrom }), let copied = effective.properties.first(where: { $0.name == copyFrom && $0.editable }), adjusted.create == true {
                adjusted = PropertyChange(id: id, baseHash: change.baseHash, name: change.name, type: copied.type, value: copied.value, remove: nil, create: true, options: copied.options)
            }
            if !raw.properties.contains(where: { $0.name == change.name }), let inherited = effective.properties.first(where: { $0.name == change.name && $0.editable }), change.create != true, change.renameTo == nil {
                guard adjusted.type == inherited.type else { throw VaultError(code: "INVALID_PROPERTY", message: "属性类型已变化，请重新打开后编辑。") }
                adjusted.create = true
                adjusted.options = inherited.options
            }
            let data = try patchNoteProperty(before, change: adjusted, updatedAt: self.compatible ? nil : timestamp())
            let identity = FileIdentity(id: id, path: existing.note.relativePath, hash: sha256(data), createdAt: existing.note.createdAt)
            let parsed = try self.compatible ? parseObsidianNote(data, relativePath: identity.path, vaultID: metadata.vaultId, identity: identity, modified: Date()) : parseNote(data, relativePath: identity.path, vaultID: metadata.vaultId)
            var updatedSnapshot = snapshot
            if let index = updatedSnapshot.notes.firstIndex(where: { $0.note.id == id }) { updatedSnapshot.notes[index] = parsed }
            let propertyData = try self.effectiveNoteProperties(data, snapshot: updatedSnapshot, config: config)
            try self.writeSource(data, before: before, at: url, identity: identity, root: root)
            return PropertyUpdateResult(note: parsed.note, propertyData: propertyData)
        } } catch { try recoverRename(); throw error }
    }

    private func writeSource(_ data: Data, before: Data?, at url: URL, identity: FileIdentity, root: URL) throws {
        if compatible {
            let journal = RenameJournal(root: root.path, scope: localScope, changes: [RenameChange(path: identity.path, before: before, after: data)], identities: identities)
            try encode(journal).write(to: renameJournalURL, options: .atomic)
        }
        try data.write(to: url, options: before == nil ? .withoutOverwriting : .atomic)
        if compatible {
            try persistIdentities(identities.filter { $0.id != identity.id } + [identity])
            try fm.removeItem(at: renameJournalURL)
        }
    }

    private struct RenameChange: Codable { let path: String; let before: Data?; let after: Data? }
    private struct RenameJournal: Codable { let root: String; let scope: String?; let changes: [RenameChange]; let identities: [FileIdentity] }
    private var renameJournalURL: URL { identityURL.appendingPathExtension("rename.json") }

    private func renameBytes(_ path: String, root: URL) throws -> Data? {
        if path.hasPrefix(".memocard/trash/") { _ = try trashLocation(String(path.dropFirst(".memocard/trash/".count))) }
        else if path != propertyDefinitionPath && path != ".memocard/pins.json" { _ = try newNotePath(path, id: "", root: root) }
        let url = root.appendingPathComponent(path)
        try validate(url, inside: root)
        return fm.fileExists(atPath: url.path) ? try readSource(url) : nil
    }

    private func recoverRename() throws {
        guard let root, metadata != nil, fm.fileExists(atPath: renameJournalURL.path) else { return }
        let journal = try JSONDecoder().decode(RenameJournal.self, from: Data(contentsOf: renameJournalURL))
        guard journal.scope.map({ $0 == localScope }) ?? (journal.root == root.path) else { throw VaultError(code: "RENAME_RECOVERY_REQUIRED", message: "保存事务恢复记录不属于当前笔记库。") }
        try coordinateWrite(root, inside: root, options: .forMerging) { _ in
            // Never roll back over an external edit. The durable journal remains available.
            for change in journal.changes {
                let current = try self.renameBytes(change.path, root: root)
                guard current == change.before || current == change.after else { throw VaultError(code: "RENAME_RECOVERY_REQUIRED", message: "保存事务期间文件被外部修改，事务记录和草稿已保留，请先处理恢复记录。") }
            }
            for change in journal.changes.reversed() {
                if try self.renameBytes(change.path, root: root) == change.before { continue }
                let url = root.appendingPathComponent(change.path)
                if let data = change.before { try data.write(to: url, options: .atomic) }
                else if self.fm.fileExists(atPath: url.path) { try self.fm.removeItem(at: url) }
            }
            if self.compatible { try self.persistIdentities(journal.identities) }
            try self.fm.removeItem(at: self.renameJournalURL)
        }
        invalidateSnapshot(); parsedCache.removeAll()
    }

    private func renameNote(_ request: SaveRequest, existing: ParsedNote, snapshot: Snapshot, to path: String, root: URL, metadata: VaultMetadata) throws -> Note {
        let old = existing.note.relativePath, renames = [old: path], paths = snapshot.notes.map { $0.note.relativePath }
        let original = try readSource(root.appendingPathComponent(old))
        guard sha256(original) == request.baseHash else { throw VaultError(code: "HASH_CONFLICT", message: "文件已在其他位置修改，原文未被覆盖。") }
        guard try renameBytes(path, root: root) == nil else { throw VaultError(code: "HASH_CONFLICT", message: "重命名目标已存在，原文未被覆盖。") }
        let parsed = try compatible ? parseObsidianNote(original, relativePath: old, vaultID: metadata.vaultId, identity: FileIdentity(id: existing.note.id, path: old, hash: sha256(original), createdAt: existing.note.createdAt), modified: Date()) : parseNote(original, relativePath: old, vaultID: metadata.vaultId)
        var frontmatter = parsed.frontmatter
        if !compatible { frontmatter["updatedAt"] = Node(timestamp(), Tag(.str), .doubleQuoted) }
        let encoded = try compatible ? encodedObsidianNote(parsed, body: request.body) : encodedNote(frontmatter: frontmatter, body: request.body, originalHeader: parsed.originalHeader)
        let data = Data(rewriteNoteLinks(String(decoding: encoded, as: UTF8.self), sourcePath: old, paths: paths, renames: renames).utf8)
        guard data.count <= 8 * 1024 * 1024 else { throw VaultError(code: "NOTE_TOO_LARGE", message: "单条 Markdown 最大支持 8 MiB。") }
        var changes = [RenameChange(path: path, before: nil, after: data)]
        for note in snapshot.notes where note.note.relativePath != old {
            let source = try readSource(root.appendingPathComponent(note.note.relativePath))
            let next = Data(rewriteNoteLinks(String(decoding: source, as: UTF8.self), sourcePath: note.note.relativePath, paths: paths, renames: renames).utf8)
            if next != source {
                guard next.count <= 8 * 1024 * 1024 else { throw VaultError(code: "NOTE_TOO_LARGE", message: "引用文件超出大小限制，重命名未提交。") }
                guard sha256(source) == note.note.contentHash else { throw VaultError(code: "HASH_CONFLICT", message: "引用笔记已被外部修改，重命名未提交。") }
                changes.append(RenameChange(path: note.note.relativePath, before: source, after: next))
            }
        }
        if compatible {
            let stored = try readStoredNotePins()
            if let date = stored.pins["path:" + old] {
                var pins = stored.pins; pins.removeValue(forKey: "path:" + old); pins["path:" + path] = date
                let before = try readSource(root.appendingPathComponent(".memocard/pins.json"))
                guard sha256(before) == stored.contentHash else { throw VaultError(code: "HASH_CONFLICT", message: "固定记录已改变，重命名未提交。") }
                changes.append(RenameChange(path: ".memocard/pins.json", before: before, after: try encode(pins)))
            }
        }
        changes.append(RenameChange(path: old, before: original, after: nil))
        let journal = RenameJournal(root: root.path, scope: localScope, changes: changes, identities: identities)
        let backup = localDataURL.appendingPathComponent("renames/\(UUID().uuidString.lowercased()).json")
        try fm.createDirectory(at: backup.deletingLastPathComponent(), withIntermediateDirectories: true)
        try encode(journal).write(to: backup, options: .atomic)
        try encode(journal).write(to: renameJournalURL, options: .atomic)
        do {
            try coordinateWrite(root, inside: root, options: .forMerging) { _ in
                for change in changes {
                    guard try self.renameBytes(change.path, root: root) == change.before else { throw VaultError(code: "HASH_CONFLICT", message: "重命名期间文件被外部修改，原文与草稿已保留。") }
                    let url = root.appendingPathComponent(change.path)
                    if let bytes = change.after { try bytes.write(to: url, options: change.before == nil ? .withoutOverwriting : .atomic) }
                    else { try self.fm.removeItem(at: url) }
                }
                if self.compatible {
                    let next = self.identities.map { item -> FileIdentity in
                        let nextPath = item.path == old ? path : item.path
                        let hash = changes.first { $0.path == nextPath && $0.after != nil }.map { sha256($0.after!) } ?? item.hash
                        return FileIdentity(id: item.id, path: nextPath, hash: hash, createdAt: item.createdAt)
                    }
                    try self.persistIdentities(next)
                }
                try self.fm.removeItem(at: self.renameJournalURL)
            }
        } catch { try recoverRename(); throw error }
        parsedCache.removeAll(); invalidateSnapshot()
        try? removeCommittedDraft(request, id: existing.note.id, tags: validatedTags(inlineTags(request.body)))
        return try compatible ? parseObsidianNote(data, relativePath: path, vaultID: metadata.vaultId, identity: FileIdentity(id: existing.note.id, path: path, hash: sha256(data), createdAt: existing.note.createdAt), modified: Date()).note : parseNote(data, relativePath: path, vaultID: metadata.vaultId).note
    }

    private func removeCommittedDraft(_ request: SaveRequest, id: String, tags: [String]) throws {
        guard metadata != nil else { return }
        let inheritedTags = try validatedTags(request.inheritedTags ?? [])
        let key = try validatedDraftKey(request.draftKey, id: id)
        let path = try draftDirectory().appendingPathComponent("\(key).json")
        try validate(path, inside: localDataURL)
        guard fm.fileExists(atPath: path.path) else { return }
        let removed = try coordinateWrite(path, inside: localDataURL, options: .forDeleting) { coordinated in
            let draft = try JSONDecoder().decode(Draft.self, from: Data(contentsOf: coordinated))
            guard (draft.pendingProperties ?? []).isEmpty else { return false }
            guard draft.id == id, draft.title == request.title, draft.body == request.body, draft.tags == tags, (draft.inheritedTags ?? []) == inheritedTags, draft.baseHash == request.baseHash else { return false }
            try self.fm.removeItem(at: coordinated)
            return true
        }
        if removed { try removeRecoveredDraft(request, id: id) }
    }

    private func listTags() throws -> Data {
        let snapshot = try snapshot(for: "listTags")
        var counts: [String: Int] = [:]
        for parsed in snapshot.notes where parsed.note.deletedAt == nil {
            let names = Set(parsed.note.tags.flatMap { tag -> [String] in
                let parts = tag.components(separatedBy: "/")
                return parts.indices.map { parts[...$0].joined(separator: "/") }
            })
            for tag in names { counts[tag, default: 0] += 1 }
        }
        struct TagCount: Encodable { let name: String; let count: Int }
        struct Result: Encodable { let tags: [TagCount]; let coverage: Coverage }
        return try encode(Result(tags: counts.keys.sorted().map { TagCount(name: $0, count: counts[$0]!) }, coverage: snapshot.coverage))
    }

    private struct DraftNamespace: Codable { let vaultId: String; let root: String }
    private let draftNamespaceFile = ".vault-scope.json"

    func draftDirectory() throws -> URL {
        // Once a vault has been opened, local drafts remain writable even if its provider goes offline.
        guard metadata != nil, let localScope else { throw VaultError(code: "VAULT_NOT_OPEN", message: "请先选择笔记库。") }
        let directory = localDataURL.appendingPathComponent("drafts/\(localScope)")
        try validate(directory, inside: localDataURL)
        try fm.createDirectory(at: directory, withIntermediateDirectories: true)
        let info = directory.appendingPathComponent(draftNamespaceFile)
        let bytes = try encode(DraftNamespace(vaultId: metadata!.vaultId, root: root!.path))
        if (try? Data(contentsOf: info)) != bytes { try coordinateWrite(info, inside: localDataURL) { try bytes.write(to: $0, options: .atomic) } }
        return directory
    }

    private func recoveryDirectory(_ source: RecoverySource) throws -> URL {
        guard metadata != nil else { throw VaultError(code: "VAULT_NOT_OPEN", message: "请先选择笔记库。") }
        guard source.unscoped == true else { return try draftDirectory() }
        guard let scope = source.scope else { return localDataURL.appendingPathComponent("drafts/\(metadata!.vaultId)") }
        guard scope.count == 64, scope.allSatisfy({ "0123456789abcdef".contains($0) }) else { throw VaultError(code: "INVALID_DRAFT", message: "草稿目录标识无效。") }
        let directory = localDataURL.appendingPathComponent("drafts/\(scope)")
        let owner = try coordinateRead(directory.appendingPathComponent(draftNamespaceFile), inside: localDataURL) { try JSONDecoder().decode(DraftNamespace.self, from: Data(contentsOf: $0)) }
        guard owner.vaultId == metadata!.vaultId else { throw VaultError(code: "INVALID_DRAFT", message: "草稿不属于当前笔记库。") }
        return directory
    }

    private func validatedDraftKey(_ value: String?, id: String) throws -> String {
        guard let value else { return id } // Existing unkeyed recovery remains readable and writable.
        if value.lowercased() == id { return id }
        let parts = value.split(separator: ":", omittingEmptySubsequences: false)
        guard parts.count == 2, let client = UUID(uuidString: String(parts[0])),
              client.uuidString.lowercased() == parts[0].lowercased(), parts[1].lowercased() == id else {
            throw VaultError(code: "INVALID_DRAFT", message: "草稿标识无效。")
        }
        return "\(client.uuidString.lowercased()):\(id)"
    }

    private func validateDraftRequest(_ request: SaveRequest, id: String) throws {
        _ = try validatedDraftKey(request.draftKey, id: id)
        if let source = request.recoveredFrom {
            _ = try validatedDraftKey(source.draftKey, id: id)
            if source.scope != nil { _ = try recoveryDirectory(source) }
        }
    }

    private func removeRecoveredDraft(_ request: SaveRequest, id: String) throws {
        guard let source = request.recoveredFrom else { return }
        let key = try validatedDraftKey(source.draftKey, id: id)
        guard key != (try validatedDraftKey(request.draftKey, id: id)) else { return }
        let directory = try recoveryDirectory(source)
        let path = directory.appendingPathComponent("\(key).json")
        guard fm.fileExists(atPath: path.path) else { return }
        try coordinateWrite(path, inside: localDataURL, options: .forDeleting) { coordinated in
            let bytes = try Data(contentsOf: coordinated)
            let draft = try JSONDecoder().decode(Draft.self, from: bytes)
            guard draft.id == id, (draft.revision ?? sha256(bytes)) == source.revision else { return }
            try self.fm.removeItem(at: coordinated)
        }
    }

    private func saveDraft(_ request: SaveRequest) throws -> Data {
        let id = try canonicalID(request.id)
        try validateDraftRequest(request, id: id)
        let tags = try validatedTags(inlineTags(request.body))
        let inheritedTags = request.baseHash == nil ? try validatedTags(request.inheritedTags ?? []) : []
        let directory = try draftDirectory()
        let key = try validatedDraftKey(request.draftKey, id: id)
        let target = directory.appendingPathComponent("\(key).json")
        let draft = Draft(title: request.title, id: id, body: request.body, tags: tags, inheritedTags: inheritedTags.isEmpty ? nil : inheritedTags, baseHash: request.baseHash,
                          relativePath: request.relativePath, updatedAt: timestamp(), pendingProperties: request.pendingProperties, draftKey: key, revision: UUID().uuidString.lowercased())
        try coordinateWrite(target, inside: localDataURL) { try encode(draft).write(to: $0, options: .atomic) }
        if request.baseHash == nil && request.title?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false && request.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && (request.pendingProperties ?? []).isEmpty {
            try? removeRecoveredDraft(request, id: id)
        }
        return try encode(draft)
    }

    private var draftReminderURL: URL { localDataURL.appendingPathComponent("draft-reminders/\(localScope!).json") }

    private func reminderKey(_ key: String, unscoped: Bool, scope: String?) -> String {
        "\(unscoped ? scope ?? "legacy" : "current")/\(key)"
    }

    private func readDraftReminders() -> [String: String] {
        (try? coordinateRead(draftReminderURL, inside: localDataURL) { try JSONDecoder().decode([String: String].self, from: Data(contentsOf: $0)) }) ?? [:]
    }

    private func dismissDraftReminder(id: String, source: RecoverySource) throws -> Data {
        let id = try canonicalID(id), key = try validatedDraftKey(source.draftKey, id: id)
        let directory = try recoveryDirectory(source)
        let fingerprint = try coordinateRead(directory.appendingPathComponent("\(key).json"), inside: localDataURL) { url in
            guard try self.fileType(url) == .typeRegular else { throw VaultError(code: "INVALID_DRAFT", message: "草稿必须是普通文件，原记录已保留。") }
            let bytes = try Data(contentsOf: url), draft = try JSONDecoder().decode(Draft.self, from: bytes)
            guard draft.id == id, (draft.revision ?? sha256(bytes)) == source.revision else {
                throw VaultError(code: "DRAFT_CHANGED", message: "草稿已变化，请重新查看后再选择是否提醒。", retryable: true)
            }
            return sha256(bytes)
        }
        var reviews = readDraftReminders()
        reviews[reminderKey(key, unscoped: source.unscoped == true, scope: source.scope)] = fingerprint
        let path = draftReminderURL
        try validate(path, inside: localDataURL)
        try fm.createDirectory(at: path.deletingLastPathComponent(), withIntermediateDirectories: true)
        try coordinateWrite(path, inside: localDataURL) { try encode(reviews).write(to: $0, options: .atomic) }
        return try encode(["reminderDismissed": true])
    }

    private struct TrashMetadata: Codable { let id: String; let relativePath: String; let createdAt: String; let deletedAt: String }
    private struct TrashedNote: Encodable { let trashKey: String; let deletedAt: String; let note: Note }

    private func trashLocation(_ key: String) throws -> (token: String, path: String, url: URL) {
        let (root, _) = try active(), parts = key.split(separator:"/",omittingEmptySubsequences:false)
        guard parts.count >= 2, !key.contains("\\") else { throw VaultError(code:"INVALID_TRASH",message:"回收记录标识无效。") }
        let token = try canonicalID(String(parts[0])), path = parts.dropFirst().joined(separator:"/")
        let sourceParts = parts.dropFirst()
        guard (compatible || sourceParts.first == "notes"), path.lowercased().hasSuffix(".md"),
              sourceParts.allSatisfy({ !$0.isEmpty && !$0.hasPrefix(".") }),
              !path.unicodeScalars.contains(where: { $0.value < 32 || $0.value == 127 }) else {
            throw VaultError(code:"PATH_NOT_ALLOWED",message:"回收记录路径无效。")
        }
        let url = root.appendingPathComponent(".memocard/trash/\(token)/\(path)")
        try validate(url,inside:root)
        return (token,path,url)
    }

    private func readTrashedNote(_ key: String) throws -> TrashedNote {
        let location = try trashLocation(key), (root, metadata) = try active()
        let bytes = try coordinateRead(location.url,inside:root) { url in
            guard try self.fileType(url) == .typeRegular else { throw VaultError(code:"INVALID_TRASH",message:"回收笔记必须是普通文件。") }
            return try self.readSource(url)
        }
        let directory = root.appendingPathComponent(".memocard/trash/\(location.token)"), info = directory.appendingPathComponent("entry.json")
        let record: TrashMetadata? = fm.fileExists(atPath:info.path) ? try coordinateRead(info,inside:root) { try JSONDecoder().decode(TrashMetadata.self,from:self.readSource($0)) } : nil
        if let record { guard record.relativePath == location.path, (try canonicalID(record.id)) == record.id else { throw VaultError(code:"INVALID_TRASH",message:"回收记录与文件不匹配。") } }
        let date = try record?.deletedAt ?? timestamp(directory.resourceValues(forKeys:[.creationDateKey]).creationDate ?? Date())
        let id = record?.id ?? location.token, createdAt = record?.createdAt ?? date
        let note = try compatible ? parseObsidianNote(bytes,relativePath:location.path,vaultID:metadata.vaultId,identity:FileIdentity(id:id,path:location.path,hash:sha256(bytes),createdAt:createdAt),modified:Date()).note : parseNote(bytes,relativePath:location.path,vaultID:metadata.vaultId).note
        if let record, note.id != record.id { throw VaultError(code:"INVALID_TRASH",message:"回收记录与笔记身份不匹配。") }
        return TrashedNote(trashKey:key,deletedAt:date,note:note)
    }

    private func getTrash() throws -> Data {
        struct Item: Encodable { let trashKey: String; let id: String; let title: String?; let relativePath: String; let deletedAt: String; let contentHash: String; let preview: String }
        struct Issue: Encodable { let path: String; let message: String }
        struct Result: Encodable { let notes: [Item]; let issues: [Issue] }
        let (root, _) = try active(), directory = root.appendingPathComponent(".memocard/trash")
        try validate(directory,inside:root)
        guard fm.fileExists(atPath:directory.path) else { return try encode(Result(notes:[],issues:[])) }
        var notes:[Item]=[], issues:[Issue]=[]
        func walk(_ folder:URL, prefix:String) throws {
            for url in try fm.contentsOfDirectory(at:folder,includingPropertiesForKeys:nil) where !url.lastPathComponent.hasPrefix(".") {
                let key = prefix.isEmpty ? url.lastPathComponent : prefix + "/" + url.lastPathComponent
                do {
                    try validate(url,inside:root)
                    if try fileType(url) == .typeDirectory { if prefix.isEmpty { _ = try canonicalID(url.lastPathComponent) }; try walk(url,prefix:key) }
                    else if url.pathExtension.lowercased() == "md" {
                        let value = try readTrashedNote(key), note=value.note
                        notes.append(Item(trashKey:key,id:note.id,title:note.title,relativePath:note.relativePath,deletedAt:value.deletedAt,contentHash:note.contentHash,preview:String(note.body.prefix(200))))
                    }
                } catch { issues.append(Issue(path:key,message:"此回收记录无法读取，原文件已保留。")) }
            }
        }
        try walk(directory,prefix:"")
        return try encode(Result(notes:notes.sorted { $0.deletedAt == $1.deletedAt ? $0.trashKey < $1.trashKey : $0.deletedAt > $1.deletedAt },issues:issues))
    }

    private func permanentlyDeleteNote(_ key: String, baseHash: String) throws -> Data {
        let location = try trashLocation(key), (root, _) = try active()
        try coordinateWrite(location.url,inside:root,options:.forDeleting) { url in
            try self.requireNoConflict(url)
            guard try self.fileType(url) == .typeRegular else { throw VaultError(code:"INVALID_TRASH",message:"回收笔记必须是普通文件。") }
            guard sha256(try self.readSource(url)) == baseHash else { throw VaultError(code:"HASH_CONFLICT",message:"回收笔记已变化，请刷新后重新确认。") }
            try self.fm.removeItem(at:url)
        }
        return try encode(["deleted":true])
    }

    private func restoreNote(_ key: String, baseHash: String) throws -> Note {
        let archived = try readTrashedNote(key), location = try trashLocation(key), (root, metadata) = try active(), snapshot = try scan()
        guard snapshot.coverage.complete else { throw VaultError(code:"SCAN_INCOMPLETE",message:"笔记库尚未完成校验，请稍后重试。",retryable:true) }
        guard !snapshot.notes.contains(where:{$0.note.id == archived.note.id}) else { throw VaultError(code:"DUPLICATE_ID",message:"此笔记身份已存在，回收记录已保留。") }
        var restored:Note?
        do { try coordinateWrite(root,inside:root,options:.forMerging) { _ in
            try self.validate(location.url,inside:root)
            try self.requireNoConflict(location.url)
            let original = try self.readSource(location.url)
            guard archived.note.contentHash == baseHash, sha256(original) == baseHash else { throw VaultError(code:"HASH_CONFLICT",message:"回收笔记已变化，请刷新后重试。") }
            var path = location.path, count = 2
            let originalURL = root.appendingPathComponent(path)
            while self.fm.fileExists(atPath:root.appendingPathComponent(path).path) {
                let name = originalURL.deletingPathExtension().lastPathComponent + " (\(count))." + originalURL.pathExtension
                path = originalURL.deletingLastPathComponent().appendingPathComponent(name).path.replacingOccurrences(of:root.path + "/",with:"");count += 1
            }
            let target = root.appendingPathComponent(path)
            try self.validate(target,inside:root);try self.fm.createDirectory(at:target.deletingLastPathComponent(),withIntermediateDirectories:true);try self.validate(target,inside:root)
            let journal = RenameJournal(root:root.path,scope:self.localScope,changes:[RenameChange(path:path,before:nil,after:original),RenameChange(path:".memocard/trash/" + key,before:original,after:nil)],identities:self.identities)
            try encode(journal).write(to:self.renameJournalURL,options:.atomic)
            // Publish fresh active-file metadata: providers can retain hidden
            // archive state when moving an inode out of .memocard/trash.
            try original.write(to: target, options: .withoutOverwriting)
            try self.fm.removeItem(at: location.url)
            let identity=FileIdentity(id:archived.note.id,path:path,hash:baseHash,createdAt:archived.note.createdAt)
            if self.compatible { try self.persistIdentities(self.identities.filter{$0.id != identity.id && $0.path != path} + [identity]) }
            try self.fm.removeItem(at:self.renameJournalURL)
            restored = try self.compatible ? parseObsidianNote(original,relativePath:path,vaultID:metadata.vaultId,identity:identity,modified:Date()).note : parseNote(original,relativePath:path,vaultID:metadata.vaultId).note
        }} catch { try recoverRename();throw error }
        parsedCache.removeAll();invalidateSnapshot()
        return restored!
    }

    private func deleteNote(id: String, baseHash: String) throws -> Data {
        let id = try canonicalID(id), (root, _) = try active(), snapshot = try scan()
        guard snapshot.coverage.complete else { throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库尚未完成校验，请稍后重试。", retryable: true) }
        guard !snapshot.duplicateIDs.contains(id) else { throw VaultError(code: "DUPLICATE_ID", message: "笔记 ID 重复，无法删除。") }
        guard let note = snapshot.notes.first(where: { $0.note.id == id })?.note, note.deletedAt == nil else { throw VaultError(code: "NOTE_NOT_FOUND", message: "找不到此笔记。") }
        let source = root.appendingPathComponent(note.relativePath)
        let trashPath = ".memocard/trash/\(UUID().uuidString.lowercased())/\(note.relativePath)"
        let target = root.appendingPathComponent(trashPath)
        do { try coordinateWrite(source, inside: root, options: .forMoving) { url in
            try self.requireNoConflict(url)
            guard try self.fileType(url) == .typeRegular else { throw VaultError(code: "PATH_NOT_ALLOWED", message: "笔记必须是普通文件。") }
            let original = try self.readSource(url)
            guard sha256(original) == baseHash else { throw VaultError(code: "HASH_CONFLICT", message: "笔记已在其他位置修改，请重新读取后再删除。") }
            try self.validate(target, inside: root)
            try self.fm.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            try self.validate(target, inside: root)
            let tokenDirectory = root.appendingPathComponent(trashPath.split(separator:"/").prefix(3).joined(separator:"/"))
            let metadataURL = tokenDirectory.appendingPathComponent("entry.json")
            try self.validate(metadataURL, inside:root)
            try encode(TrashMetadata(id:id,relativePath:note.relativePath,createdAt:note.createdAt,deletedAt:timestamp())).write(to:metadataURL,options:.atomic)
            let journal = RenameJournal(root:root.path,scope:self.localScope,changes:[RenameChange(path:trashPath,before:nil,after:original),RenameChange(path:note.relativePath,before:original,after:nil)],identities:self.identities)
            try encode(journal).write(to:self.renameJournalURL,options:.atomic)
            try self.fm.moveItem(at: url, to: target)
            if self.compatible { try self.persistIdentities(self.identities.filter{$0.id != id}) }
            try self.fm.removeItem(at:self.renameJournalURL)
        }} catch { try recoverRename();throw error }
        parsedCache.removeAll(); invalidateSnapshot()
        struct Deleted: Encodable { let id: String; let relativePath: String; let trashPath: String; let trashKey: String; let contentHash: String }
        return try encode(Deleted(id: id, relativePath: note.relativePath, trashPath: trashPath,
                                  trashKey: String(trashPath.dropFirst(".memocard/trash/".count)), contentHash: baseHash))
    }

    private func deleteDraft(id: String, source: RecoverySource) throws -> Data {
        let id = try canonicalID(id), key = try validatedDraftKey(source.draftKey, id: id)
        let path = try recoveryDirectory(source).appendingPathComponent("\(key).json")
        try coordinateWrite(path, inside: localDataURL, options: .forDeleting) { url in
            guard self.fm.fileExists(atPath: url.path) else { throw VaultError(code: "DRAFT_CHANGED", message: "草稿已变化，请刷新草稿后重试。", retryable: true) }
            guard try self.fileType(url) == .typeRegular else { throw VaultError(code: "INVALID_DRAFT", message: "草稿必须是普通文件，原记录已保留。") }
            let bytes = try Data(contentsOf: url), draft = try JSONDecoder().decode(Draft.self, from: bytes)
            guard draft.id == id, (draft.revision ?? sha256(bytes)) == source.revision else {
                throw VaultError(code: "DRAFT_CHANGED", message: "草稿已变化，请刷新草稿后重试。", retryable: true)
            }
            try self.fm.removeItem(at: url)
        }
        return try encode(["deleted": true])
    }

    private func getDrafts() throws -> Data {
        struct Issue: Encodable { let path: String; let code: String; let message: String }
        struct Result: Encodable { let drafts: [Draft]; let unscopedDrafts: [Draft]; let issues: [Issue] }
        var drafts: [Draft] = [], unscopedDrafts: [Draft] = [], issues: [Issue] = []
        let directory = try draftDirectory()
        let reviews = readDraftReminders()
        let legacy = localDataURL.appendingPathComponent("drafts/\(metadata!.vaultId)")
        var folders: [(URL, Bool, String?)] = [(directory, false, nil), (legacy, true, nil)]
        // A cross-volume move is indistinguishable from copying then removing the original.
        // Keep abandoned instances discoverable, but require explicit selection instead of auto-binding.
        let siblings = try fm.contentsOfDirectory(at: directory.deletingLastPathComponent(), includingPropertiesForKeys: nil)
        for sibling in siblings where sibling != directory && sibling != legacy {
            if let owner = try? coordinateRead(sibling.appendingPathComponent(draftNamespaceFile), inside: localDataURL, { try JSONDecoder().decode(DraftNamespace.self, from: Data(contentsOf: $0)) }), owner.vaultId == metadata!.vaultId, !fm.fileExists(atPath: owner.root) {
                folders.append((sibling, true, sibling.lastPathComponent))
            }
        }
        for (folder, unscoped, scope) in folders where fm.fileExists(atPath: folder.path) {
            do {
                let paths = try coordinateRead(folder, inside: localDataURL) { try self.fm.contentsOfDirectory(at: $0, includingPropertiesForKeys: nil) }
                for path in paths where path.pathExtension == "json" && path.lastPathComponent != draftNamespaceFile {
                    do {
                        let draft = try coordinateRead(path, inside: localDataURL) { url -> Draft in
                            guard try self.fileType(url) == .typeRegular else { throw VaultError(code: "INVALID_DRAFT", message: "草稿必须是普通文件，原记录已保留。") }
                            let bytes = try Data(contentsOf: url)
                            var value = try JSONDecoder().decode(Draft.self, from: bytes)
                            guard try canonicalID(value.id) == value.id else { throw VaultError(code: "INVALID_DRAFT", message: "草稿标识无效。") }
                            value.draftKey = try self.validatedDraftKey(value.draftKey, id: value.id)
                            guard url.deletingPathExtension().lastPathComponent == value.draftKey else { throw VaultError(code: "INVALID_DRAFT", message: "草稿文件名与标识不一致，原记录已保留。") }
                            _ = try parseDate(value.updatedAt)
                            value.revision = value.revision ?? sha256(bytes)
                            value.unscoped = unscoped ? true : nil
                            value.recoveryScope = scope
                            value.reminderDismissed = reviews[self.reminderKey(value.draftKey!, unscoped: unscoped, scope: scope)] == sha256(bytes) ? true : nil
                            return value
                        }
                        if unscoped { unscopedDrafts.append(draft) } else { drafts.append(draft) }
                    } catch {
                        issues.append(Issue(path: path.path, code: (error as? VaultError)?.code ?? "CORRUPT_DRAFT", message: "此草稿无法读取或格式无效，原文件已保留，可从此路径检查或备份。"))
                    }
                }
            } catch {
                issues.append(Issue(path: folder.path, code: "DRAFT_DIRECTORY_UNAVAILABLE", message: "此恢复目录暂时无法读取，原记录已保留。"))
            }
        }
        return try encode(Result(drafts: drafts.sorted { $0.updatedAt > $1.updatedAt }, unscopedDrafts: unscopedDrafts.sorted { $0.updatedAt > $1.updatedAt }, issues: issues))
    }

    private func importAttachment(name: String, base64: String, noteID: String?, requestedPath: String?) throws -> Data {
        let (root, _) = try active()
        guard !name.isEmpty, name == (name as NSString).lastPathComponent, !name.contains("\\"),
              let data = Data(base64Encoded: base64), !data.isEmpty,
              let source = CGImageSourceCreateWithData(data as CFData, nil), CGImageSourceGetCount(source) > 0,
              let type = CGImageSourceGetType(source), let uniformType = UTType(type as String),
              uniformType.conforms(to: .image), let ext = uniformType.preferredFilenameExtension else {
            throw VaultError(code: "INVALID_ATTACHMENT", message: "附件必须是可识别的图片，文件名不能包含目录。")
        }
        let supportedTypes: Set<String> = [UTType.png.identifier, UTType.jpeg.identifier, UTType.gif.identifier,
                                           UTType.webP.identifier, UTType.heic.identifier, UTType.heif.identifier]
        guard supportedTypes.contains(uniformType.identifier) else {
            throw VaultError(code: "UNSUPPORTED_ATTACHMENT", message: "暂不支持此图片格式，请先转换为 PNG、JPEG、GIF、WebP、HEIC 或 HEIF。")
        }
        var notePath = compatible ? "new.md" : "notes/new.md"
        if let noteID {
            let id = try canonicalID(noteID)
            let snapshot = try scan()
            guard !snapshot.duplicateIDs.contains(id) else {
                throw VaultError(code: "DUPLICATE_ID", message: "笔记 ID 重复，无法确定图片引用位置。")
            }
            guard snapshot.coverage.complete else {
                throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库包含待下载、冲突或格式异常文件，暂时无法确定图片引用位置。", retryable: true)
            }
            if let note = snapshot.notes.first(where: { $0.note.id == id })?.note {
                guard note.deletedAt == nil else { throw VaultError(code: "NOTE_DELETED", message: "此笔记已删除，无法导入图片。") }
                notePath = note.relativePath
            } else {
                notePath = try newNotePath(requestedPath, id: id, root: root)
            }
        }
        let path = "assets/\(UUID().uuidString.lowercased()).\(ext)"
        let target = root.appendingPathComponent(path)
        try validate(target, inside: root)
        try fm.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
        try coordinateWrite(target, inside: root) { url in
            guard !self.fm.fileExists(atPath: url.path) else { throw VaultError(code: "FILE_EXISTS", message: "附件文件已存在。") }
            try data.write(to: url, options: .atomic)
        }
        struct Result: Encodable { let relativePath: String; let markdownPath: String; let notePath: String }
        let directoryDepth = notePath.split(separator: "/").count - 1
        return try encode(Result(relativePath: path, markdownPath: String(repeating: "../", count: directoryDepth) + path,
                                 notePath: notePath))
    }

    private func resolveLink(_ target: String, sourcePath: String, wiki: Bool) throws -> Data {
        let (root, _) = try active()
        let snapshot = try scan()
        guard snapshot.coverage.complete else { throw VaultError(code: "SCAN_INCOMPLETE", message: "笔记库尚未完整读取，无法安全解析链接。") }
        let raw = String(target.split(separator: "#", omittingEmptySubsequences: false).first ?? "")
        guard let decoded = wiki ? raw : raw.removingPercentEncoding, !decoded.isEmpty,
              !decoded.contains("\\"), !decoded.contains(":"), !decoded.unicodeScalars.contains(where: { $0.value < 32 }) else {
            throw VaultError(code: "LINK_NOT_FOUND", message: "链接路径无效。")
        }
        var paths = snapshot.notes.map { $0.note.relativePath }
        if let enumerator = fm.enumerator(at: root, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]) {
            for case let url as URL in enumerator {
                try validate(url, inside: root)
                if ["png", "jpg", "jpeg", "gif", "webp", "heic", "heif"].contains(url.pathExtension.lowercased()), try fileType(url) == .typeRegular {
                    paths.append(relative(url, root: root))
                }
            }
        }
        func normalized(_ value: String) -> String? {
            var parts: [String] = []
            for part in value.split(separator: "/", omittingEmptySubsequences: false) {
                if part == "." || part.isEmpty { continue }
                if part == ".." { guard !parts.isEmpty else { return nil }; parts.removeLast() }
                else { guard !part.hasPrefix(".") else { return nil }; parts.append(String(part)) }
            }
            return parts.joined(separator: "/")
        }
        let directory = sourcePath.split(separator: "/").dropLast().joined(separator: "/")
        let relativeTarget = directory.isEmpty ? decoded : directory + "/" + decoded
        var matches: [String] = []
        for candidate in wiki ? [decoded, relativeTarget] : [relativeTarget, decoded] {
            if let path = normalized(candidate) {
                matches = paths.filter { $0 == path || $0 == path + ".md" }
                if !matches.isEmpty { break }
            }
        }
        if matches.isEmpty && wiki && !decoded.hasPrefix("/") && !decoded.split(separator: "/").contains(where: { $0.hasPrefix(".") }) {
            matches = paths.filter { $0.hasSuffix("/" + decoded) || $0.hasSuffix("/" + decoded + ".md") }
        }
        guard matches.count == 1 else { throw VaultError(code: matches.isEmpty ? "LINK_NOT_FOUND" : "AMBIGUOUS_LINK", message: matches.isEmpty ? "找不到链接目标。" : "链接匹配多份文件，请使用完整路径。") }
        struct Link: Encodable { let kind: String; let id: String?; let path: String }
        let note = snapshot.notes.first { $0.note.relativePath == matches[0] }?.note
        return try encode(Link(kind: note == nil ? "image" : "note", id: note?.id, path: matches[0]))
    }

    var identityURL: URL { localDataURL.appendingPathComponent("identities-\(localScope!).json") }

    private func persistIdentities(_ values: [FileIdentity]) throws {
        if values.map({ "\($0.id):\($0.path):\($0.hash)" }) != identities.map({ "\($0.id):\($0.path):\($0.hash)" }) {
            try encode(values).write(to: identityURL, options: .atomic)
        }
        identities = values
    }

    private func readSource(_ url: URL) throws -> Data {
        guard try isAvailable(url) else { throw VaultError(code: "FILE_PENDING", message: "文件尚未下载。", retryable: true) }
        let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size <= 8 * 1024 * 1024 else { throw VaultError(code: "NOTE_TOO_LARGE", message: "M1 单条 Markdown 最大支持 8 MiB。") }
        sourceReadCount += 1
        return try Data(contentsOf: url)
    }

    private func isAvailable(_ url: URL) throws -> Bool {
        let values = try url.resourceValues(forKeys: [.isUbiquitousItemKey, .ubiquitousItemDownloadingStatusKey])
        guard values.isUbiquitousItem == true else { return true }
        if values.ubiquitousItemDownloadingStatus == .current { return true }
        try? fm.startDownloadingUbiquitousItem(at: url)
        return false
    }

    private func requireNoConflict(_ url: URL) throws {
        guard (NSFileVersion.unresolvedConflictVersionsOfItem(at: url) ?? []).isEmpty else {
            throw VaultError(code: "SOURCE_CONFLICT", message: "文件存在未解决的 iCloud 版本冲突，原版本均已保留。")
        }
    }

    private func fileType(_ url: URL) throws -> FileAttributeType? {
        var value = stat()
        guard lstat(url.path, &value) == 0 else {
            if errno == ENOENT { throw CocoaError(.fileReadNoSuchFile) }
            throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno))
        }
        switch value.st_mode & S_IFMT {
        case S_IFREG: return .typeRegular
        case S_IFDIR: return .typeDirectory
        case S_IFLNK: return .typeSymbolicLink
        default: return .typeUnknown
        }
    }

    private func isInside(_ candidate: URL, _ root: URL) -> Bool {
        candidate.path == root.path || candidate.path.hasPrefix(root.path + "/")
    }

    private func relative(_ url: URL, root: URL) -> String {
        // File coordination may return /private/var while the selected URL uses /var.
        String(url.standardizedFileURL.path.dropFirst(root.path.count + 1))
    }

    private func validate(_ url: URL, inside root: URL) throws {
        let candidate = url.standardizedFileURL
        let resolved = realpath(root.path, nil)
        defer { free(resolved) }
        guard isInside(candidate, root), try fileType(root) == .typeDirectory,
              let resolved, URL(fileURLWithPath: String(cString: resolved)).standardizedFileURL.path == root.path else {
            throw VaultError(code: "PATH_NOT_ALLOWED", message: "文件路径超出授权目录或授权目录已改变。")
        }
        var current = root
        let suffix = candidate.pathComponents.dropFirst(root.pathComponents.count)
        for part in suffix {
            current.appendPathComponent(part)
            do {
                if try fileType(current) == .typeSymbolicLink {
                    throw VaultError(code: "SYMLINK_NOT_ALLOWED", message: "笔记库不允许符号链接。")
                }
            } catch let error as VaultError { throw error }
            catch let error as CocoaError where error.code == .fileReadNoSuchFile { break }
        }
    }

    private func coordinateRead<T>(_ url: URL, inside root: URL, _ body: (URL) throws -> T) throws -> T {
        try validate(url, inside: root)
        var coordinationError: NSError?
        var result: Result<T, Error>?
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { coordinated in
            result = Result { try self.validate(coordinated, inside: root); return try body(coordinated) }
        }
        if let coordinationError { throw coordinationError }
        guard let result else { throw VaultError(code: "COORDINATION_FAILED", message: "未能获得文件读取权限。", retryable: true) }
        return try result.get()
    }

    private func coordinateWrite<T>(_ url: URL, inside root: URL, options: NSFileCoordinator.WritingOptions = .forReplacing, _ body: (URL) throws -> T) throws -> T {
        try validate(url, inside: root)
        var coordinationError: NSError?
        var result: Result<T, Error>?
        NSFileCoordinator().coordinate(writingItemAt: url, options: options, error: &coordinationError) { coordinated in
            result = Result { try self.validate(coordinated, inside: root); return try body(coordinated) }
        }
        if let coordinationError { throw coordinationError }
        guard let result else { throw VaultError(code: "COORDINATION_FAILED", message: "未能获得文件写入权限。", retryable: true) }
        return try result.get()
    }
}
