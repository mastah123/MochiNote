package com.mochinote.app.data

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface NoteDao {
    @Query("SELECT * FROM notes WHERE trashed = 0 AND archived = 0 ORDER BY updated DESC")
    fun active(): Flow<List<NoteEntity>>

    @Query("SELECT * FROM notes WHERE id = :id")
    suspend fun get(id: String): NoteEntity?

    @Upsert
    suspend fun upsert(note: NoteEntity)
}

@Dao
interface FolderDao {
    @Query("SELECT * FROM folders ORDER BY created ASC")
    fun all(): Flow<List<FolderEntity>>

    @Upsert
    suspend fun upsert(folder: FolderEntity)
}
