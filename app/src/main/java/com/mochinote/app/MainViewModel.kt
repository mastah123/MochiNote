package com.mochinote.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.mochinote.app.data.FolderEntity
import com.mochinote.app.data.MochiDb
import com.mochinote.app.data.NoteEntity
import com.mochinote.app.data.PrefsStore
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val db = MochiDb.get(app)
    private val prefs = PrefsStore(app)

    val notes: StateFlow<List<NoteEntity>> =
        db.notes().active().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val folders: StateFlow<List<FolderEntity>> =
        db.folders().all().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    val userName: StateFlow<String> =
        prefs.userName.stateIn(viewModelScope, SharingStarted.Eagerly, "")
    // starts as true so the welcome dialog does not flash before the saved value is read
    val welcomed: StateFlow<Boolean> =
        prefs.welcomed.stateIn(viewModelScope, SharingStarted.Eagerly, true)

    fun setName(value: String) = viewModelScope.launch { prefs.setName(value.trim().take(30)) }
    fun markWelcomed() = viewModelScope.launch { prefs.setWelcomed() }

    fun newId(): String = UUID.randomUUID().toString()

    suspend fun load(id: String): NoteEntity? = db.notes().get(id)

    /** Saves the note; a brand-new note that is still empty is not stored. */
    fun save(id: String, title: String, body: String) {
        viewModelScope.launch {
            val old = db.notes().get(id)
            if (old == null && title.isBlank() && body.isBlank()) return@launch
            val now = System.currentTimeMillis()
            val base = old ?: NoteEntity(id = id, created = now, updated = now)
            db.notes().upsert(
                base.copy(
                    title = title,
                    text = body,
                    html = body.split("\n").joinToString("") { "<div>" + escapeHtml(it).ifEmpty { "<br>" } + "</div>" },
                    tags = extractTags("$title\n$body"),
                    updated = now,
                )
            )
        }
    }

    fun trash(id: String) {
        viewModelScope.launch {
            val old = db.notes().get(id) ?: return@launch
            val now = System.currentTimeMillis()
            db.notes().upsert(old.copy(trashed = true, trashedAt = now, pinned = false))
        }
    }

    fun addFolder(name: String) {
        val n = name.trim()
        if (n.isEmpty()) return
        viewModelScope.launch {
            db.folders().upsert(FolderEntity(id = newId(), name = n.take(40), created = System.currentTimeMillis()))
        }
    }

    private fun escapeHtml(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    private fun extractTags(s: String): String =
        Regex("#([\\p{L}\\p{N}_-]+)").findAll(s).map { it.groupValues[1].lowercase() }.distinct().joinToString(",")
}
