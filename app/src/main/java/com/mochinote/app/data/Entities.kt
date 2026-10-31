package com.mochinote.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/** Same fields as the web app's notes, so a web backup can be imported later. */
@Entity(tableName = "notes")
data class NoteEntity(
    @PrimaryKey val id: String,
    val title: String = "",
    val html: String = "",
    val text: String = "",
    val tags: String = "",
    val folderId: String? = null,
    val color: String = "default",
    val pinned: Boolean = false,
    val archived: Boolean = false,
    val trashed: Boolean = false,
    val trashedAt: Long? = null,
    val created: Long,
    val updated: Long,
    val icon: String? = null,
    val tint: String? = null,
    val emoji: String? = null,
    val due: String? = null,
)

@Entity(tableName = "folders")
data class FolderEntity(
    @PrimaryKey val id: String,
    val name: String,
    val created: Long,
    val icon: String? = null,
    val color: String? = null,
)
