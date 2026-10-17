package com.example

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.example.data.model.PresetBassInstruments
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.math.abs

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class ExampleRobolectricTest {

    @Test
    fun `read app_name string from context`() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val appName = context.getString(R.string.app_name)
        assertEquals("SubForge Bass", appName)
    }

    @Test
    fun `twelve original instruments each generate 12 modulated chromatic notes`() {
        val presets = PresetBassInstruments.originals
        assertEquals("Must include 12 original bass instruments", 12, presets.size)

        presets.forEach { instrument ->
            val modulatedPads = instrument.generate12NotePads(octaveShift = 0)
            assertEquals("Each instrument must have 12 modulated note pads", 12, modulatedPads.size)
            assertTrue(
                "First pad frequency must match baseFreqHz",
                abs(modulatedPads[0].frequencyHz.toDouble() - instrument.baseFreqHz) < 0.05
            )
            assertTrue(
                "12th pad frequency must be higher than 1st pad",
                modulatedPads[11].frequencyHz > modulatedPads[0].frequencyHz
            )
        }
    }
}
