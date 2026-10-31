package com.mochinote.app.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bookmark
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Code
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.Flight
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.Sell
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.StickyNote2
import androidx.compose.material.icons.outlined.Work
import androidx.compose.ui.graphics.vector.ImageVector
import com.mochinote.app.ui.theme.TINT_NAMES

/** The icon names the web app saves (note.icon / folder.icon) mapped to Material icons. */
fun glyphFor(name: String?): ImageVector? = when (name) {
    "doc" -> Icons.Outlined.Description
    "file" -> Icons.Outlined.StickyNote2
    "folder" -> Icons.Outlined.Folder
    "tag" -> Icons.Outlined.Sell
    "bulb" -> Icons.Outlined.Lightbulb
    "star" -> Icons.Outlined.Star
    "heart" -> Icons.Outlined.Favorite
    "bookmark" -> Icons.Outlined.Bookmark
    "calendar" -> Icons.Outlined.CalendarMonth
    "cart" -> Icons.Outlined.ShoppingCart
    "briefcase" -> Icons.Outlined.Work
    "book" -> Icons.Outlined.MenuBook
    "code" -> Icons.Outlined.Code
    "home" -> Icons.Outlined.Home
    "plane" -> Icons.Outlined.Flight
    "music" -> Icons.Outlined.MusicNote
    "check" -> Icons.Outlined.CheckCircle
    "pin" -> Icons.Outlined.PushPin
    else -> null
}

val ROW_ICONS = listOf("doc", "folder", "tag", "file", "bulb")
val ROW_TINTS = listOf("pink", "blue", "green", "lilac", "yellow")
val TILE_ICONS = listOf("doc", "folder", "tag", "bulb")
val TILE_TINTS = listOf("pink", "blue", "lilac", "green")

/** Same hashing as the web app, so a note keeps its default icon and colour. */
fun hashIdx(id: String, m: Int): Int {
    var h = 0L
    for (ch in id) h = (h * 31 + ch.code) and 0xFFFFFFFFL
    return (h % m).toInt()
}

fun okTint(t: String?): String? = if (t != null && t in TINT_NAMES) t else null
