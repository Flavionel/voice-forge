import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { ipcMain } from 'electron'

// Configure logging
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'

// Auto-download updates silently in the background
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

let mainWindow = null

export function initAutoUpdater(window) {
  mainWindow = window

  // Set up event handlers
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version)
    sendToRenderer('update:status', { status: 'available', version: info.version })
  })

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version)
    sendToRenderer('update:status', { status: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err.message)
    // Don't bother the user with update errors
  })

  // IPC handler: user clicked "Restart to Update"
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // Check for updates after a short delay (don't block startup)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Update check failed:', err.message)
    })
  }, 10000)
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}
