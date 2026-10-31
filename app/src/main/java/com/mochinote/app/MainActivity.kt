package com.mochinote.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mochinote.app.ui.MochiNav
import com.mochinote.app.ui.theme.MochiTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MochiTheme {
                val vm: MainViewModel = viewModel()
                MochiNav(vm)
            }
        }
    }
}
