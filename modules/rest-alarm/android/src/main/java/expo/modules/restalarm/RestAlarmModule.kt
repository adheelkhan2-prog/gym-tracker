package expo.modules.restalarm

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.react.androidContext
import io.github.expo.modules.v2.react.currentActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * The rest timer's lock-screen countdown: one ongoing notification with a count-down chronometer.
 * Android draws the ticking clock itself, so it stays right with the screen off or the app asleep,
 * and the notification removes itself at 0:00 (the "Rest is over" alert is a separate exact alarm).
 */
@ExpoModule("RestAlarm")
class RestAlarmModule : Module() {
  private val notifications: NotificationManager
    get() = androidContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  /**
   * Returns false (and shows nothing) below Android 8, where a notification can't remove itself at
   * 0:00: the app then keeps its own updated countdown instead.
   */
  @JS
  suspend fun showCountdown(endsAt: Double, title: String, body: String, channelId: String, color: String): Boolean = withContext(Dispatchers.Main) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@withContext false
    val ctx = androidContext
    val end = endsAt.toLong()
    val left = end - System.currentTimeMillis()
    if (left <= 0) {
      notifications.cancel(COUNTDOWN_ID)
      return@withContext true
    }
    if (notifications.getNotificationChannel(channelId) == null) {
      val ch = NotificationChannel(channelId, "Rest timer (countdown)", NotificationManager.IMPORTANCE_LOW)
      ch.setSound(null, null)
      ch.enableVibration(false)
      ch.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      notifications.createNotificationChannel(ch)
    }
    val builder = Notification.Builder(ctx, channelId).setTimeoutAfter(left)
    builder
      .setSmallIcon(smallIcon(ctx))
      .setContentTitle(title)
      .setContentText(body)
      .setWhen(end)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setAutoCancel(false)
      .setCategory(Notification.CATEGORY_STOPWATCH)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setColor(runCatching { Color.parseColor(color) }.getOrDefault(Color.RED))
    openApp(ctx)?.let { builder.setContentIntent(it) }
    notifications.notify(COUNTDOWN_ID, builder.build())
    true
  }

  @JS
  suspend fun cancelCountdown(): Unit = withContext(Dispatchers.Main) {
    notifications.cancel(COUNTDOWN_ID)
  }

  @JS
  suspend fun isIgnoringBatteryOptimizations(): Boolean = withContext(Dispatchers.Main) {
    val pm = androidContext.getSystemService(Context.POWER_SERVICE) as PowerManager
    pm.isIgnoringBatteryOptimizations(androidContext.packageName)
  }

  /** The system "Stop optimising battery usage?" dialog for this app; else the settings list. */
  @SuppressLint("BatteryLife")
  @JS
  suspend fun openBatteryOptimization(): Boolean = withContext(Dispatchers.Main) {
    val pkg = androidContext.packageName
    start(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$pkg"))) ||
      start(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) ||
      start(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")))
  }

  /** Huawei / Honor keep their own launch manager on top of Android's battery optimisation. */
  @JS
  suspend fun openOemBatterySettings(): Boolean = withContext(Dispatchers.Main) {
    OEM_SCREENS.any { (pkg, cls) -> start(Intent().setComponent(ComponentName(pkg, cls))) }
  }

  @JS
  suspend fun manufacturer(): String = Build.MANUFACTURER.lowercase()

  private fun start(intent: Intent): Boolean {
    val activity = currentActivity
    return try {
      if (activity != null) activity.startActivity(intent) else androidContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      true
    } catch (e: Exception) {
      false
    }
  }

  private fun openApp(ctx: Context): PendingIntent? {
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return null
    launch.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    return PendingIntent.getActivity(ctx, COUNTDOWN_ID, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  /** The notification icon expo-notifications set up (white silhouette), else the app icon. */
  private fun smallIcon(ctx: Context): Int {
    val id = ctx.resources.getIdentifier("notification_icon", "drawable", ctx.packageName)
    return if (id != 0) id else ctx.applicationInfo.icon
  }

  companion object {
    private const val COUNTDOWN_ID = 7311
    private val OEM_SCREENS = listOf(
      "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
      "com.huawei.systemmanager" to "com.huawei.systemmanager.appcontrol.activity.StartupAppControlActivity",
      "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
      "com.hihonor.systemmanager" to "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
    )
  }
}
