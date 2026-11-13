import { useState, useCallback } from "react"
import { check } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"

export type UpdateStatus =
  "idle" | "checking" | "up-to-date" | "downloading" | "restarting" | "error"

export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>("idle")
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)

  const checkForUpdates = useCallback(async () => {
    setStatus("checking")
    setDownloadProgress(null)
    try {
      const update = await check()
      if (!update) {
        setStatus("up-to-date")
        return
      }

      setStatus("downloading")
      let totalBytes: number | undefined
      let downloaded = 0

      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength
          downloaded = 0
          setDownloadProgress(0)
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength
          if (totalBytes) {
            setDownloadProgress(Math.round((downloaded / totalBytes) * 100))
          }
        } else if (event.event === "Finished") {
          setDownloadProgress(100)
        }
      })

      setStatus("restarting")
      await relaunch()
    } catch (err) {
      console.error("[updater] check failed:", err)
      setStatus("error")
    }
  }, [])

  const dismiss = useCallback(() => {
    setStatus("idle")
    setDownloadProgress(null)
  }, [])

  return { status, downloadProgress, checkForUpdates, dismiss }
}
