<template>
  <div>
    <div style="margin-top: 10px;">
      <button @touchstart="captureAndSendToOpenAI" @click="captureAndSendToOpenAI" :disabled="!stream">押す</button>
    </div>
    <video ref="video" autoplay playsinline width="100%" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const video = ref(null)
const stream = ref(null)
const preferredVoice = ref(null)

const isMobile = () => /iPhone|Android.+Mobile/.test(navigator.userAgent)

const startCamera = async () => {
  try {
    const constraints = {
      video: {
        facingMode: isMobile() ? 'environment' : 'user'
      }
    }
    stream.value = await navigator.mediaDevices.getUserMedia(constraints)
    video.value.srcObject = stream.value
  } catch (err) {
    alert('カメラを起動できませんでした: ' + err.message)
  }
}

const initVoices = () => {
  const voices = speechSynthesis.getVoices()
  console.log('利用可能な音声:', voices)

  preferredVoice.value = voices.find(
    (v) => v.lang === 'ja-JP' && v.name.includes('Hattori')
  )
}

const speakText = (text) => {
  if (!window.speechSynthesis) {
    alert("このブラウザは音声読み上げに対応していません。")
    return
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'

  if (preferredVoice.value) {
    utterance.voice = preferredVoice.value
  }

  speechSynthesis.speak(utterance)
}

const captureAndSendToOpenAI = async () => {
  alert('送信中...')
  const videoEl = video.value
  if (!videoEl) return

  // 元のvideoサイズを取得
  const originalWidth = videoEl.videoWidth
  const originalHeight = videoEl.videoHeight

  // リサイズ後のサイズを決定（横幅320px固定、縦横比維持）
  const targetWidth = 320
  const aspectRatio = originalHeight / originalWidth
  const targetHeight = Math.round(targetWidth * aspectRatio)

  // canvasサイズを縮小
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  // 描画（ここで縮小される）
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoEl, 0, 0, targetWidth, targetHeight)

  // Base64形式（data URL）を取得
  const base64Image = canvas.toDataURL('image/jpeg')

  const OPENAI_API_KEY = useRuntimeConfig().public.OPENAI_API_KEY

  // OpenAI APIへ送信
  try {
    alert('送信準備ができました')
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: base64Image
                }
              },
              {
                type: 'text',
                text: '何が写っているか教えてください。'
              }
            ]
          }
        ],
        max_tokens: 300
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAIリクエスト失敗: ${response.status}`)
    }

    const result = await response.json()

    const aiText = result.choices[0]?.message?.content
    alert('AIからの応答: ' + aiText)
    console.log(aiText)
    speakText(aiText)
  } catch (err) {
    alert('送信エラー: ' + err.message)
  }
}

onMounted(() => {
  startCamera()
  speechSynthesis.onvoiceschanged = () => {
    initVoices()
  }
  alert('カメラを起動しました。')
})
</script>
