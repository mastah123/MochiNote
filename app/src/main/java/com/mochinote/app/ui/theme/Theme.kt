package com.mochinote.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** One pastel tint: background, border, foreground (icon) and ink (text). */
data class Tint(val bg: Color, val bd: Color, val fg: Color, val ink: Color)

/** Extra Mochi colours that Material's scheme has no slot for. */
class MochiColors(
    val tints: Map<String, Tint>,
    val border: Color,
    val muted: Color,
    val banner: Color,
    val bannerInk: Color,
    val accentSoft: Color,
)

val LocalMochi = staticCompositionLocalOf<MochiColors> { error("MochiTheme missing") }

val TINT_NAMES = listOf("pink", "blue", "lilac", "green", "yellow")

private fun c(hex: Long) = Color(0xFF000000 or hex)

private val LightTints = mapOf(
    "pink" to Tint(c(0xFDEEEB), c(0xF9DCD7), c(0xE0766F), c(0xC4605A)),
    "blue" to Tint(c(0xEAF1FD), c(0xD8E5FA), c(0x4F86D9), c(0x3F6FB8)),
    "lilac" to Tint(c(0xF1ECFC), c(0xE3DBF7), c(0x7D63C8), c(0x6A52B3)),
    "green" to Tint(c(0xEAF5E8), c(0xD8EBD3), c(0x6AA05F), c(0x558A4B)),
    "yellow" to Tint(c(0xFCF3DC), c(0xF6E6BB), c(0xD3A03A), c(0xB9862A)),
)
private val DarkTints = mapOf(
    "pink" to Tint(c(0x3B2828), c(0x4B3232), c(0xF0948C), c(0xF0948C)),
    "blue" to Tint(c(0x202E45), c(0x2B3D5A), c(0x7FB0F5), c(0x7FB0F5)),
    "lilac" to Tint(c(0x2C2840), c(0x3A3558), c(0xB5A2F0), c(0xB5A2F0)),
    "green" to Tint(c(0x25352A), c(0x31463A), c(0x8FCB83), c(0x8FCB83)),
    "yellow" to Tint(c(0x3D3420), c(0x4D4228), c(0xEAC15A), c(0xEAC15A)),
)

private val LightMochi = MochiColors(LightTints, c(0xECE6DF), c(0x78879D), c(0xFBEEE4), c(0x5B6579), c(0xFDEEEB))
private val DarkMochi = MochiColors(DarkTints, c(0x2C3542), c(0x93A0B4), c(0x2E2723), c(0xB4BCCB), c(0x3A2523))

private val LightScheme = lightColorScheme(
    primary = c(0xE07A73), onPrimary = Color.White,
    primaryContainer = c(0xFDEEEB), onPrimaryContainer = c(0x16233B),
    secondaryContainer = c(0xFDEEEB), onSecondaryContainer = c(0x16233B),
    background = c(0xFBF9F6), onBackground = c(0x16233B),
    surface = c(0xFFFDFB), onSurface = c(0x16233B),
    surfaceVariant = c(0xF5F0EA), onSurfaceVariant = c(0x78879D),
    outline = c(0xECE6DF), outlineVariant = c(0xECE6DF),
)
private val DarkScheme = darkColorScheme(
    primary = c(0xEC8F87), onPrimary = c(0x2A1613),
    primaryContainer = c(0x3A2523), onPrimaryContainer = c(0xE8EDF5),
    secondaryContainer = c(0x3A2523), onSecondaryContainer = c(0xE8EDF5),
    background = c(0x14181F), onBackground = c(0xE8EDF5),
    surface = c(0x1B212B), onSurface = c(0xE8EDF5),
    surfaceVariant = c(0x232B37), onSurfaceVariant = c(0x93A0B4),
    outline = c(0x2C3542), outlineVariant = c(0x2C3542),
)

@Composable
fun MochiTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalMochi provides (if (dark) DarkMochi else LightMochi)) {
        MaterialTheme(colorScheme = if (dark) DarkScheme else LightScheme, content = content)
    }
}
