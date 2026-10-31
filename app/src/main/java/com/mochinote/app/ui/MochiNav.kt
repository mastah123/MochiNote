package com.mochinote.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.mochinote.app.MainViewModel
import com.mochinote.app.ui.theme.LocalMochi

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val TABS = listOf(
    Tab("home", "Home", Icons.Outlined.Home),
    Tab("notes", "Notes", Icons.Outlined.Folder),
    Tab("categories", "Categories", Icons.Outlined.GridView),
    Tab("settings", "Settings", Icons.Outlined.Settings),
)

@Composable
fun MochiNav(vm: MainViewModel) {
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val route = entry?.destination?.route
    val welcomed by vm.welcomed.collectAsStateWithLifecycle()

    Scaffold(
        bottomBar = {
            if (TABS.any { it.route == route }) {
                NavigationBar {
                    TABS.forEach { t ->
                        NavigationBarItem(
                            selected = route == t.route,
                            onClick = {
                                nav.navigate(t.route) {
                                    popUpTo("home")
                                    launchSingleTop = true
                                }
                            },
                            icon = { Icon(t.icon, contentDescription = null) },
                            label = { Text(t.label) },
                        )
                    }
                }
            }
        },
    ) { pad ->
        NavHost(nav, startDestination = "home", modifier = Modifier.padding(pad).consumeWindowInsets(pad)) {
            composable("home") {
                HomeScreen(
                    vm,
                    onOpen = { nav.navigate("note/$it") },
                    onNew = { nav.navigate("note/${vm.newId()}") },
                    onNotes = { nav.navigate("notes") { popUpTo("home"); launchSingleTop = true } },
                )
            }
            composable("notes") { ComingSoon("All notes", "The full notes list, search and sorting arrive in the next batch.") }
            composable("categories") { ComingSoon("Categories", "Folders with icons and colours arrive in the next batch.") }
            composable("settings") { ComingSoon("Settings", "Themes, backup and profile arrive in a later batch.") }
            composable("note/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { e ->
                NoteScreen(vm, e.arguments?.getString("id") ?: vm.newId(), onBack = { nav.popBackStack() })
            }
        }
    }

    if (!welcomed) {
        NameDialog(
            title = "Welcome to MochiNote",
            label = "Your name",
            confirm = "Get started",
            dismiss = "Skip",
            message = "What should we call you? Your name shows in the Home greeting.",
            onDone = { vm.setName(it); vm.markWelcomed() },
            onCancel = { vm.markWelcomed() },
        )
    }
}

@Composable
private fun ComingSoon(title: String, text: String) {
    Box(Modifier.padding(24.dp), contentAlignment = Alignment.Center) {
        Text("$title\n\n$text", color = LocalMochi.current.muted)
    }
}
