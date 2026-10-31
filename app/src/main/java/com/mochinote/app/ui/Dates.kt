package com.mochinote.app.ui

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/** "Today", "Yesterday", "Oct 24" (adds the year for other years). */
fun homeDate(ts: Long): String {
    val d = Instant.ofEpochMilli(ts).atZone(ZoneId.systemDefault()).toLocalDate()
    val today = LocalDate.now()
    val diff = ChronoUnit.DAYS.between(d, today)
    return when {
        diff <= 0 -> "Today"
        diff == 1L -> "Yesterday"
        else -> d.format(DateTimeFormatter.ofPattern(if (d.year == today.year) "MMM d" else "MMM d, yyyy"))
    }
}

fun greetingWord(): String {
    val h = LocalTime.now().hour
    return if (h < 12) "Good morning" else if (h < 18) "Good afternoon" else "Good evening"
}
