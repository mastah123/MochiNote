package com.mochinote.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [NoteEntity::class, FolderEntity::class], version = 1, exportSchema = false)
abstract class MochiDb : RoomDatabase() {
    abstract fun notes(): NoteDao
    abstract fun folders(): FolderDao

    companion object {
        @Volatile private var instance: MochiDb? = null

        fun get(context: Context): MochiDb =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(context.applicationContext, MochiDb::class.java, "mochinote.db")
                    .build().also { instance = it }
            }
    }
}
