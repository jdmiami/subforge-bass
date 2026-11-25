package com.example.ui

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import java.io.ByteArrayInputStream

private const val LOCAL_APP_HOST = "subforge.local"
private const val LOCAL_APP_ORIGIN = "https://$LOCAL_APP_HOST"
private const val LOCAL_APP_ENTRY = "$LOCAL_APP_ORIGIN/index.html"

private class SubForgeAndroidBridge(private val context: Context) {
    @JavascriptInterface
    fun isAndroidApp(): Boolean = true

    @JavascriptInterface
    fun vibrate(durationMs: Int) {
        val ms = durationMs.coerceIn(4, 80).toLong()
        try {
            val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val mgr = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                mgr?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            if (vibrator?.hasVibrator() == true) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(
                        VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)
                    )
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(ms)
                }
            }
        } catch (_: Throwable) {
            // Ignore haptic errors on devices without vibrator permission/hardware
        }
    }
}

private fun mimeTypeForPath(path: String): String = when {
    path.endsWith(".html", ignoreCase = true) -> "text/html"
    path.endsWith(".css", ignoreCase = true) -> "text/css"
    path.endsWith(".js", ignoreCase = true) || path.endsWith(".mjs", ignoreCase = true) -> "application/javascript"
    path.endsWith(".json", ignoreCase = true) -> "application/json"
    path.endsWith(".svg", ignoreCase = true) -> "image/svg+xml"
    path.endsWith(".png", ignoreCase = true) -> "image/png"
    path.endsWith(".jpg", ignoreCase = true) || path.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
    path.endsWith(".woff2", ignoreCase = true) -> "font/woff2"
    path.endsWith(".ttf", ignoreCase = true) -> "font/ttf"
    else -> "application/octet-stream"
}

/**
 * Full-screen hardware-accelerated Android host for the redesigned SubForge Bass
 * Liquid-Metal Game Menu, Infinite Open-Octave Morph Grid, and Second-Hand 14-Gesture Modulator.
 *
 * Serves bundled assets from `web/` over a local virtual HTTPS origin (`https://subforge.local`)
 * so ES modules, Web Audio API, localStorage, and multi-touch Pointer Events work 100% offline.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun LiquidMetalWebAppScreen() {
    val context = LocalContext.current

    val webView = remember(context) {
        WebView(context).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(android.graphics.Color.parseColor("#06070A"))
            overScrollMode = View.OVER_SCROLL_NEVER
            isHorizontalScrollBarEnabled = false
            isVerticalScrollBarEnabled = false
            isHapticFeedbackEnabled = true

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                useWideViewPort = true
                loadWithOverviewMode = true
                cacheMode = WebSettings.LOAD_DEFAULT
            }

            addJavascriptInterface(SubForgeAndroidBridge(context), "SubForgeAndroid")

            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest?) {
                    val req = request ?: return
                    val audioResources = req.resources.filter {
                        it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
                    }.toTypedArray()
                    if (audioResources.isNotEmpty()) {
                        req.grant(audioResources)
                    } else {
                        req.deny()
                    }
                }
            }

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    val uri = request?.url ?: return null
                    if (uri.host != LOCAL_APP_HOST) return null

                    val rawPath = (uri.path ?: "/index.html").trimStart('/')
                    val assetPath = if (rawPath.isEmpty()) "index.html" else rawPath
                    if (assetPath.contains("..")) return null

                    return try {
                        val stream = context.assets.open(assetPath)
                        val mime = mimeTypeForPath(assetPath)
                        val encoding = if (
                            mime.startsWith("text/") ||
                            mime == "application/javascript" ||
                            mime == "application/json" ||
                            mime == "image/svg+xml"
                        ) "UTF-8" else null

                        WebResourceResponse(
                            mime,
                            encoding,
                            200,
                            "OK",
                            mapOf(
                                "Access-Control-Allow-Origin" to LOCAL_APP_ORIGIN,
                                "Cache-Control" to "no-cache"
                            ),
                            stream
                        )
                    } catch (_: Throwable) {
                        WebResourceResponse(
                            "text/plain",
                            "UTF-8",
                            404,
                            "Not Found",
                            emptyMap(),
                            ByteArrayInputStream("Not Found".toByteArray())
                        )
                    }
                }

                override fun shouldOverrideUrlLoading(
                    view: WebView?,
                    request: WebResourceRequest?
                ): Boolean {
                    val uri = request?.url ?: return false
                    if (uri.host == LOCAL_APP_HOST) return false
                    return try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                        true
                    } catch (_: Throwable) {
                        false
                    }
                }
            }

            loadUrl(LOCAL_APP_ENTRY)
        }
    }

    // Route Android system Back button to close sheets or toggle the Liquid-Metal Game Menu
    BackHandler {
        webView.evaluateJavascript(
            "window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));",
            null
        )
    }

    DisposableEffect(webView) {
        onDispose {
            webView.stopLoading()
            webView.destroy()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF06070A))
            .windowInsetsPadding(WindowInsets.safeDrawing)
    ) {
        AndroidView(
            factory = { webView },
            modifier = Modifier.fillMaxSize()
        )
    }
}
