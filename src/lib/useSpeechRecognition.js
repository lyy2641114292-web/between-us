// ============================================================
// 语音识别封装（Web Speech API）
// 决策见 docs/复刻差异清单.md 3.2：改为真实录音 + 识别
// - 仅 Chrome / Edge 可用；不支持时回调不支持提示，不抛异常
// - 不落盘、不上传本项目服务器（本项目无服务器）
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react'

function getRecognitionCtor() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export const SPEECH_SUPPORTED = () => Boolean(getRecognitionCtor())

export function useSpeechRecognition({ lang = 'zh-CN', onResult, onError } = {}) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const resultCb = useRef(onResult)
  const errorCb = useRef(onError)

  useEffect(() => {
    resultCb.current = onResult
    errorCb.current = onError
  }, [onResult, onError])

  useEffect(() => {
    return () => {
      if (recRef.current) {
        try {
          recRef.current.stop()
        } catch {
          /* 忽略 */
        }
        recRef.current = null
      }
    }
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      errorCb.current?.('unsupported')
      return false
    }
    if (recRef.current) return true

    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 1

    rec.onresult = (event) => {
      let text = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript
      }
      if (text.trim()) resultCb.current?.(text.trim())
    }
    rec.onerror = (event) => {
      // not-allowed = 权限被拒；no-speech = 没听到；network = 网络问题
      errorCb.current?.(event.error || 'unknown')
    }
    rec.onend = () => {
      setListening(false)
      recRef.current = null
    }

    try {
      rec.start()
      recRef.current = rec
      setListening(true)
      return true
    } catch {
      errorCb.current?.('start-failed')
      recRef.current = null
      setListening(false)
      return false
    }
  }, [lang])

  const stop = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop()
      } catch {
        /* 忽略 */
      }
    }
  }, [])

  return { listening, start, stop, supported: SPEECH_SUPPORTED() }
}
