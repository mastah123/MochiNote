package com.mochinote.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AddCircleOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.mochinote.app.MainViewModel
import com.mochinote.app.data.FolderEntity
import com.mochinote.app.data.NoteEntity
import com.mochinote.app.ui.theme.LocalMochi
import com.mochinote.app.ui.theme.Tint

@Composable
fun HomeScreen(vm: MainViewModel, onOpen: (String) -> Unit, onNew: () -> Unit, onNotes: () -> Unit) {
    val notes by vm.notes.collectAsStateWithLifecycle()
    val folders by vm.folders.collectAsStateWithLifecycle()
    val name by vm.userName.collectAsStateWithLifecycle()
    var newFolder by remember { mutableStateOf(false) }

    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { Greeting(name, onNew) }
        item { FolderTiles(folders, notes, onNewFolder = { newFolder = true }) }
        item { RecentCard(notes.take(5), onOpen, onNotes) }
        item { Banner() }
    }

    if (newFolder) {
        NameDialog(
            title = "New folder",
            label = "Folder name",
            confirm = "Create",
            dismiss = "Cancel",
            onDone = { vm.addFolder(it); newFolder = false },
            onCancel = { newFolder = false },
        )
    }
}

@Composable
private fun Greeting(name: String, onNew: () -> Unit) {
    val mochi = LocalMochi.current
    Column {
        Row(verticalAlignment = Alignment.Top) {
            Text(
                text = if (name.isBlank()) greetingWord() + "!" else greetingWord() + ",\n" + name + "!",
                fontSize = 26.sp, lineHeight = 32.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            Button(
                onClick = onNew,
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = mochi.tints.getValue("lilac").bg,
                    contentColor = MaterialTheme.colorScheme.onSurface,
                ),
            ) {
                Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(6.dp))
                Text("New Note", fontWeight = FontWeight.Medium)
            }
        }
        Spacer(Modifier.height(6.dp))
        Text("Small notes. Big ideas. Keep going!", color = mochi.muted, fontSize = 14.sp)
    }
}

@Composable
private fun FolderTiles(folders: List<FolderEntity>, notes: List<NoteEntity>, onNewFolder: () -> Unit) {
    val shown = folders.take(4)
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
        shown.forEachIndexed { i, f ->
            val tn = okTint(f.color) ?: TILE_TINTS[i % 4]
            val count = notes.count { it.folderId == f.id }
            Tile(
                modifier = Modifier.weight(1f),
                tint = LocalMochi.current.tints.getValue(tn),
                icon = glyphFor(f.icon) ?: glyphFor(TILE_ICONS[i % 4])!!,
                name = f.name,
                count = count.toString(),
                dashed = false,
                onClick = {},
            )
        }
        if (shown.size < 4) {
            Tile(
                modifier = Modifier.weight(1f),
                tint = null,
                icon = Icons.Outlined.AddCircleOutline,
                name = "New folder",
                count = "",
                dashed = true,
                onClick = onNewFolder,
            )
        }
        // keep the tiles the same width when fewer than four are shown
        repeat((3 - shown.size).coerceAtLeast(0)) { Spacer(Modifier.weight(1f)) }
    }
}

@Composable
private fun Tile(
    modifier: Modifier,
    tint: Tint?,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    name: String,
    count: String,
    dashed: Boolean,
    onClick: () -> Unit,
) {
    val mochi = LocalMochi.current
    Surface(
        modifier = modifier.height(88.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        color = tint?.bg ?: MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, tint?.bd ?: mochi.border),
    ) {
        Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.SpaceBetween) {
            Icon(icon, contentDescription = null, tint = tint?.fg ?: mochi.muted, modifier = Modifier.size(24.dp))
            Column {
                Text(name, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (count.isNotEmpty()) Text(count, fontSize = 13.sp, color = tint?.ink ?: mochi.muted, fontWeight = FontWeight.Medium)
            }
        }
    }
}

@Composable
private fun RecentCard(notes: List<NoteEntity>, onOpen: (String) -> Unit, onNotes: () -> Unit) {
    val mochi = LocalMochi.current
    Surface(
        shape = RoundedCornerShape(22.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, mochi.border),
    ) {
        Column(Modifier.padding(horizontal = 18.dp, vertical = 14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Recent Notes", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                TextButton(onClick = onNotes) {
                    Text("View all", color = mochi.muted)
                    Spacer(Modifier.width(4.dp))
                    Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, tint = mochi.muted, modifier = Modifier.size(18.dp))
                }
            }
            if (notes.isEmpty()) {
                Text("No notes yet. Tap New Note to write your first one.", color = mochi.muted, modifier = Modifier.padding(vertical = 12.dp))
            }
            notes.forEachIndexed { i, n ->
                NoteRow(n, onClick = { onOpen(n.id) })
                if (i < notes.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(mochi.border))
            }
        }
    }
}

@Composable
fun NoteRow(n: NoteEntity, onClick: () -> Unit) {
    val mochi = LocalMochi.current
    val k = hashIdx(n.id, ROW_ICONS.size)
    val tint = mochi.tints.getValue(okTint(n.tint) ?: ROW_TINTS[k])
    val lines = n.text.lines().map { it.trim() }.filter { it.isNotEmpty() }.toMutableList()
    val title = n.title.trim().ifEmpty { lines.removeFirstOrNull() ?: "Untitled" }
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(tint.bg),
            contentAlignment = Alignment.Center,
        ) {
            if (!n.emoji.isNullOrEmpty()) {
                Text(n.emoji, fontSize = 22.sp)
            } else {
                Icon(glyphFor(n.icon) ?: glyphFor(ROW_ICONS[k])!!, contentDescription = null, tint = tint.fg, modifier = Modifier.size(24.dp))
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val sub = lines.joinToString("  •  ")
            if (sub.isNotEmpty()) Text(sub, fontSize = 13.sp, color = mochi.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(8.dp))
        Text((if (n.pinned) "📌 " else "") + homeDate(n.updated), fontSize = 12.sp, color = mochi.muted)
    }
}

@Composable
private fun Banner() {
    val mochi = LocalMochi.current
    Surface(shape = RoundedCornerShape(18.dp), color = mochi.banner, modifier = Modifier.fillMaxWidth()) {
        Text(
            "A little progress each day\nleads to big results.",
            color = mochi.bannerInk, fontSize = 13.sp, lineHeight = 20.sp,
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 14.dp),
        )
    }
}

/** A small one-field dialog (used for the first-run name and for new folders). */
@Composable
fun NameDialog(
    title: String, label: String, confirm: String, dismiss: String,
    initial: String = "", message: String? = null,
    onDone: (String) -> Unit, onCancel: () -> Unit,
) {
    var value by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onCancel,
        title = { Text(title) },
        text = {
            Column {
                if (message != null) {
                    Text(message, color = LocalMochi.current.muted)
                    Spacer(Modifier.height(12.dp))
                }
                OutlinedTextField(value = value, onValueChange = { value = it.take(40) }, label = { Text(label) }, singleLine = true)
            }
        },
        confirmButton = { TextButton(onClick = { onDone(value) }) { Text(confirm) } },
        dismissButton = { TextButton(onClick = onCancel) { Text(dismiss) } },
    )
}
