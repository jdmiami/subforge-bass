package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val SubForgeDarkColorScheme = darkColorScheme(
    primary = NeonCyan,
    onPrimary = StudioObsidian,
    primaryContainer = NeonCyanDim,
    onPrimaryContainer = TextPrimary,
    secondary = ElectricMagenta,
    onSecondary = TextPrimary,
    secondaryContainer = ElectricMagentaDim,
    onSecondaryContainer = TextPrimary,
    tertiary = AcidLime,
    onTertiary = StudioObsidian,
    background = StudioObsidian,
    onBackground = TextPrimary,
    surface = StudioSurface,
    onSurface = TextPrimary,
    surfaceVariant = StudioSurfaceElevated,
    onSurfaceVariant = TextSecondary,
    outline = StudioBorder,
    error = ErrorCrimson
)

@Composable
fun MyApplicationTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = SubForgeDarkColorScheme,
        typography = Typography,
        content = content
    )
}
