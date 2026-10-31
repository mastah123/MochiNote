package com.mochinote.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.mochinote.app.MainViewModel
import com.mochinote.app.ui.theme.LocalMochi
import kotlinx.coroutines.delay

/** Batch 1: a plain-text note (title + body) that saves itself. The rich-text editor arrives in a later batch. */
@Composable
fun NoteScreen(vm: MainViewModel, id: String, onBack: () -> Unit) {
    var title by remember(id) { mutableStateOf("") }
    var body by remember(id) { mutableStateOf("") }
    var loaded by remember(id) { mutableStateOf(false) }
    val mochi = LocalMochi.current

    LaunchedEffect(id) {
        vm.load(id)?.let { title = it.title; body = it.text }
        loaded = true
    }
    // save a moment after typing stops
    LaunchedEffect(title, body, loaded) {
        if (!loaded) return@LaunchedEffect
        delay(500)
        vm.save(id, title, body)
    }
    val leave = {
        if (loaded) vm.save(id, title, body)
        onBack()
    }
    BackHandler(onBack = leave)

    val transparent = TextFieldDefaults.colors(
        focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent,
        focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent,
        disabledIndicatorColor = Color.Transparent,
    )

    Column(Modifier.fillMaxSize().imePadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
            IconButton(onClick = leave) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back") }
            Spacer(Modifier.weight(1f))
            IconButton(onClick = { vm.trash(id); onBack() }) { Icon(Icons.Outlined.Delete, contentDescription = "Move to Trash") }
        }
        TextField(
            value = title, onValueChange = { title = it },
            placeholder = { Text("Title", color = mochi.muted) },
            textStyle = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface),
            colors = transparent, modifier = Modifier.fillMaxWidth(),
        )
        TextField(
            value = body, onValueChange = { body = it },
            placeholder = { Text("Start writing…", color = mochi.muted) },
            textStyle = TextStyle(fontSize = 17.sp, lineHeight = 25.sp, color = MaterialTheme.colorScheme.onSurface),
            colors = transparent,
            modifier = Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()),
        )
    }
}
