package com.mochinote.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.mochiPrefs by preferencesDataStore(name = "mochinote_prefs")

class PrefsStore(private val context: Context) {
    private val nameKey = stringPreferencesKey("userName")
    private val welcomedKey = booleanPreferencesKey("welcomed")

    val userName: Flow<String> = context.mochiPrefs.data.map { it[nameKey] ?: "" }
    val welcomed: Flow<Boolean> = context.mochiPrefs.data.map { it[welcomedKey] ?: false }

    suspend fun setName(value: String) {
        context.mochiPrefs.edit { it[nameKey] = value }
    }

    suspend fun setWelcomed() {
        context.mochiPrefs.edit { it[welcomedKey] = true }
    }
}
